import JsSIP from "jssip";
import { useDialerStore } from "../store/dialerStore";
import {
  connectDialerWS,
  disconnectDialerWS,
  sendPresence,
} from "./dialer.api";

let ua: any;
let activeSipKey = "";

// helper trace
const trace = () =>
  `sip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const startSIP = (config: {
  uri: string;
  password: string;
  wsServers: string;
}) => {
  const traceId = trace();

  console.log("[SIP][START_REQUEST]", {
    traceId,
    uri: config.uri,
    wsServers: config.wsServers,
    hasPassword: !!config.password,
  });

  const sipKey = `${config.uri}|${config.wsServers}`;

  if (ua && activeSipKey === sipKey) {
    console.log("[SIP][SKIP_ALREADY_RUNNING]", { traceId, sipKey });
    return;
  }

  if (ua && activeSipKey !== sipKey) {
    console.log("[SIP][RESTARTING_UA]", { traceId, old: activeSipKey, new: sipKey });
    try {
      ua.stop();
    } catch (e) {
      console.log("[SIP][UA_STOP_ERROR]", e);
    }
    ua = null;
  }

  console.log("[SIP][CREATING_SOCKET]", {
    traceId,
    wsServers: config.wsServers,
  });

  const socket = new JsSIP.WebSocketInterface(config.wsServers);
  const wsSocket = socket as any;

  // JsSIP socket interface events (transport-level visibility)
  wsSocket.onconnect = () => {
    console.log("[SIP][SOCKET_CONNECTED]", {
      traceId,
      wsServers: config.wsServers,
    });
  };
  wsSocket.ondisconnect = (e: any) => {
    console.log("[SIP][SOCKET_DISCONNECTED]", {
      traceId,
      wsServers: config.wsServers,
      code: e?.code,
      reason: e?.reason,
      wasClean: e?.wasClean,
    });
  };
  wsSocket.ondata = (data: any) => {
    const text = typeof data === "string" ? data : "";
    if (text.startsWith("SIP/2.0")) {
      console.log("[SIP][SOCKET_DATA]", {
        traceId,
        firstLine: text.split("\r\n")[0],
      });
    }
  };

  console.log("[SIP][CREATING_UA]", {
    traceId,
    uri: config.uri,
  });

  ua = new JsSIP.UA({
    sockets: [socket],
    uri: config.uri,
    password: config.password,
  });

  activeSipKey = sipKey;

  // =========================
  // SIP LIFECYCLE EVENTS
  // =========================

  ua.on("connecting", () => {
    console.log("[SIP][CONNECTING]", { traceId, uri: config.uri });
  });

  ua.on("connected", () => {
    console.log("[SIP][CONNECTED]", { traceId, uri: config.uri });
  });

  ua.on("registered", () => {
    console.log("[SIP][REGISTERED]", { traceId, uri: config.uri });

    useDialerStore.getState().setSipRegistered(true);

    connectDialerWS();
    sendPresence();
  });

  ua.on("unregistered", () => {
    console.log("[SIP][UNREGISTERED]", { traceId, uri: config.uri });

    useDialerStore.getState().setSipRegistered(false);
    sendPresence();
  });

  ua.on("registrationFailed", (e: any) => {
    console.log("[SIP][REGISTRATION_FAILED]", {
      traceId,
      uri: config.uri,
      cause: e?.cause,
      responseCode: e?.response?.status_code,
      reason: e?.response?.reason_phrase,
    });

    useDialerStore.getState().setSipRegistered(false);
    sendPresence();
  });

  ua.on("disconnected", () => {
    console.log("[SIP][DISCONNECTED]", { traceId, uri: config.uri });

    useDialerStore.getState().setSipRegistered(false);
    sendPresence();

    ua = null;
    activeSipKey = "";
  });

  ua.on("newRTCSession", (data: any) => {
    console.log("[SIP][NEW_RTC_SESSION]", {
      traceId,
      originator: data?.originator,
    });

    if (data?.originator !== "remote") return;

    const session = data.session;
    const caller =
      session?.remote_identity?.uri?.user ||
      data?.request?.from?.uri?.user ||
      "Unknown";

    const store = useDialerStore.getState();
    store.setIncomingSession(session);
    store.setCallerNumber(String(caller));
    store.setCallState("ringing");

    session.on("accepted", () => {
      console.log("[SIP][CALL_ACCEPTED]", { traceId, caller });

      const s = useDialerStore.getState();
      s.setCallState("in-call");
      s.setActiveCall({
        direction: "inbound",
        from: String(caller),
      });
    });

    const endCall = () => {
      console.log("[SIP][CALL_ENDED_OR_FAILED]", { traceId, caller });
      useDialerStore.getState().clearCurrentCall();
    };

    session.on("ended", endCall);
    session.on("failed", endCall);
  });

  console.log("[SIP][UA_STARTING]", { traceId });

  ua.start();
  console.log("[SIP][UA_START_CALLED]", { traceId, uri: config.uri });
};

export const answerIncomingCall = () => {
  const { incomingSession } = useDialerStore.getState();
  if (!incomingSession) return;

  console.log("[SIP][ANSWER_CALL]");

  incomingSession.answer({
    mediaConstraints: { audio: true, video: false },
  });
};

export const rejectIncomingCall = () => {
  const { incomingSession } = useDialerStore.getState();
  if (!incomingSession) return;

  console.log("[SIP][REJECT_CALL]");

  incomingSession.terminate();
  useDialerStore.getState().clearCurrentCall();
};

export const hangupCurrentCall = () => {
  const { incomingSession } = useDialerStore.getState();
  if (!incomingSession) return;

  console.log("[SIP][HANGUP_CALL]");

  incomingSession.terminate();
  useDialerStore.getState().clearCurrentCall();
};

export const stopSIP = () => {
  console.log("[SIP][STOP]");

  try {
    if (ua) {
      ua.stop();
      ua = null;
    }
    activeSipKey = "";
  } finally {
    useDialerStore.getState().setSipRegistered(false);
    useDialerStore.getState().clearCurrentCall();
    disconnectDialerWS();
  }
};
