# Inbound + Outbound Agent Routing Steps (Project Notes)

This document summarizes the implemented flow across the first 8 steps, including file additions/updates and practical test commands.

---

## Current Goal Achieved

- Outbound call from RabbitMQ can be routed to a logged-in WebRTC/SIP browser agent on answer.
- Carrier inbound DID can be parked and routed to inbound agent pool.
- Agent state is managed in Redis (`portalOnline`, `sipRegistered`, availability, locks, cooldown).
- Directory auth is served over HTTP (`mod_xml_curl`) by `dialer-aio`.

---

## Step 1 — Browser agents reachable (WebRTC + SIP over WS/WSS)

### Files
- `freeswitch/conf/sip_profiles/internal.xml`
  - `ws-binding` and `wss-binding`
  - TLS/WebRTC-related params
- `dialer-aio/deployment/deployment.yaml`
  - Exposed container ports for SIP WS/WSS (`5066`, `7443`)
- `dialer-aio/deployment/fs-configmap.yaml`
  - codec/certs/network vars

### Verify
```bash
# FreeSWITCH profile status
fs_cli -x "sofia status profile internal"

# Check WS/WSS listeners in pod/host
ss -tulpn | egrep ':(5066|7443)\b'
```

---

## Step 2 — Backend agent state model in Redis

### Files
- `dialer-aio/index.js`
  - agent config/env parsing
  - `saveAgent/getAgent`, pools, locks, cooldown
  - portal WS presence handler
  - SIP register/unregister sync handlers

### Redis keys used
- `agent:<agentId>`
- `agent:ext:<extension>`
- `pool:inbound`, `pool:outbound`
- `lock:agent:<agentId>`
- `agent:cooldown:<direction>:<agentId>`

### Verify
```bash
redis-cli KEYS "agent:*"
redis-cli ZRANGE pool:inbound 0 -1 WITHSCORES
redis-cli ZRANGE pool:outbound 0 -1 WITHSCORES
```

---

## Step 3 — Inbound entry into app (DID -> park -> app)

### Files
- `freeswitch/conf/dialplan/public/inbound_router.xml`
  - DID match in `public`
  - sets tags (`call_type`, `call_role`, `route_group`, DID/from vars)
  - parks call
- `freeswitch/Dockerfile`
  - copies public dialplan file into FS paths
- `dialer-aio/index.js`
  - listens to `CHANNEL_CREATE` + `CHANNEL_PARK`
  - inbound park handler starts routing

### Verify
```bash
fs_cli -x "reloadxml"
fs_cli -x "dialplan show"
fs_cli -x "sofia status"
```

---

## Step 4 — Agent leg dialing strategy (timeouts/retry/cooldown)

### Files
- `dialer-aio/index.js`
  - `routeCallToAgentWithRetry(...)`
  - bridge result tracking (`bridgePromises`)
  - retry with ring timeout + cooldown
- `dialer-aio/deployment/deployment.yaml`
  - `AGENT_RING_TIMEOUT_SEC`
  - `AGENT_MAX_ATTEMPTS_PER_CALL`
  - `AGENT_COOLDOWN_SEC` (test value currently low)

### Verify
```bash
# app logs should show attempts and cooldown
kubectl logs -n dialerv2 deploy/dialer-freeswitch -c dialer-aio --tail=200 | grep -E "Attempting to ring agent|cooldown|All .* attempts failed"
```

---

## Step 5 — Outbound flow (RabbitMQ -> customer answer -> outbound pool)

### Files
- `dialer-aio/index.js`
  - outbound answer path uses retry router for outbound pool
  - call route reporting persisted in Redis (`callroute:<customerUuid>`)
  - captures agent leg UUID and bridge timestamps

### Route record key
- `callroute:<customerUuid>`
  - includes `transactionId`, `agentId`, `agentLegUuid`, timestamps, cause/disposition

### Verify
```bash
redis-cli KEYS "callroute:*"
redis-cli HGETALL callroute:<customer_uuid>
```

---

## Step 6 — Inbound flow (carrier DID -> queue wait -> inbound pool)

### Files
- `dialer-aio/index.js`
  - inbound queue loop with max wait + retry gap
  - hold prompt / MOH behavior
  - timeout fallback handling
- `dialer-aio/deployment/deployment.yaml`
  - `INBOUND_MAX_WAIT_SEC`
  - `INBOUND_RETRY_GAP_MS`
  - `INBOUND_HOLD_PROMPT`

### Verify
```bash
kubectl logs -n dialerv2 deploy/dialer-freeswitch -c dialer-aio --tail=300 | grep -E "Inbound call parked|queue retry|queue timeout|successfully routed"
```

---

## Step 7 — ESL event model + role classification

### Files
- `dialer-aio/index.js`
  - subscribes: `CHANNEL_CREATE`, `CHANNEL_PARK`, `CHANNEL_ANSWER`, `CHANNEL_HANGUP_COMPLETE`
  - `classifyChannel(...)` central role resolver
  - role tags handled: `inbound_customer`, `outbound_customer`, `agent_leg`
- `freeswitch/conf/dialplan/public/inbound_router.xml`
  - sets `call_role=inbound_customer`
- outbound originate vars include `call_role=outbound_customer`
- agent bridge dialstring includes `call_role=agent_leg` and `cc_member_uuid`

### Verify
```bash
kubectl logs -n dialerv2 deploy/dialer-freeswitch -c dialer-aio --tail=300 | grep -E "channel created|Agent leg created|Answered .* role|Agent leg hangup"
```

---

## Step 8 — Concurrency/race protection

### Files
- `dialer-aio/index.js`
  - customer assignment lock:
    - `assign_lock:<customer_uuid>`
    - acquire/release helpers with owner-safe release
  - agent lock:
    - `lock:agent:<agentId>`
  - lock release now in `finally` blocks
  - handles agent answer after customer hangup (kills agent leg, releases agent)

### Verify
```bash
redis-cli KEYS "assign_lock:*"
redis-cli KEYS "lock:agent:*"
kubectl logs -n dialerv2 deploy/dialer-freeswitch -c dialer-aio --tail=300 | grep -E "assign_lock|already being assigned|customer already hung up"
```

---

## Directory (HTTP XML_CURL) integration

### Files
- `freeswitch/conf/autoload_configs/modules.conf.xml`
  - `mod_xml_curl` loaded
- `freeswitch/conf/autoload_configs/xml_curl.conf.xml`
  - `gateway-url=http://127.0.0.1:3000/freeswitch/directory`
  - basic auth params
- `dialer-aio/index.js`
  - new `POST /freeswitch/directory` handler
  - parses XML_CURL params, authorizes request, returns valid FS directory XML
- `dialer-aio/deployment/deployment.yaml`
  - `FS_DIRECTORY_API_*` env values

### Expected Redis user keys for auth lookup
- `fsdir:user:<extension>` or `directory:user:<extension>`
- fields:
  - `password` **or** `a1Hash`/`a1_hash`
  - optional: `userContext`, `callerIdName`, `callerIdNumber`, `agentId`

### Quick endpoint test (inside pod/network)
```bash
curl -u fsxml:FSDirectorySharedSecret2026 \
  -X POST "http://127.0.0.1:3000/freeswitch/directory" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "section=directory&tag_name=user&key_name=id&key_value=1001&domain=dialerv2.local"
```

---

## Outbound test payload (agent routing on answer)

Use this JSON (RabbitMQ message or test API payload):

```json
{
  "transactionId": "txn-20260418-0001",
  "numberTo": "+15551234567",
  "numberFrom": "+15557654321",
  "routeToAgent": true,
  "wavUrlAnnounce": "https://cdn.example.com/announce.wav",
  "wavUrlVM": "https://cdn.example.com/vm.wav",
  "wavUrlContinue": "https://cdn.example.com/continue.wav",
  "wavUrlOptOut": "https://cdn.example.com/optout.wav",
  "digitContinue": "1",
  "digitOptOut": "2",
  "destinationAddress": "sip:15550001111@carrier.example.com",
  "companyId": "cmp-001",
  "prefix": ""
}
```

---

## Deployment/reload checklist

```bash
# Rebuild/redeploy your updated images/workloads
kubectl apply -f dialer-aio/deployment/fs-configmap.yaml
kubectl apply -f dialer-aio/deployment/deployment.yaml

# Inside FS
fs_cli -x "reloadxml"
fs_cli -x "sofia profile internal rescan"
fs_cli -x "sofia status profile internal reg"
```

---

## Known current tuning note

- `AGENT_COOLDOWN_SEC` is intentionally low for testing.  
  For production behavior, set to `30-60` seconds.

