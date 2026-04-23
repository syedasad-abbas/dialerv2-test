"use strict";

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { createClient } = require("redis");

const config = {
  port: parseInt(process.env.AUTH_API_PORT || "3100", 10),
  redisUri: process.env.REDIS_URI || "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET || "replace-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  sipDomain: process.env.SIP_DOMAIN || "dialerv2.local",
  sipWsUrl: process.env.SIP_WS_URL || "wss://127.0.0.1:7443",
  seedAdminOnStart:
    String(process.env.SEED_ADMIN_ON_START || "false").toLowerCase() === "true",
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Pass@123",
  seedAdminName: process.env.SEED_ADMIN_NAME || "Portal Admin",
  seedAdminExtension: process.env.SEED_ADMIN_EXTENSION || "1001",
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const redis = createClient({ url: config.redisUri });
redis.on("error", (err) => console.error("redis error", err.message));

function nowIso() {
  return new Date().toISOString();
}

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function userKey(userId) {
  return `portal:user:${userId}`;
}

function usernameKey(username) {
  return `portal:user:username:${normalize(username)}`;
}

function emailKey(email) {
  return `portal:user:email:${normalize(email)}`;
}

async function getUserById(userId) {
  if (!userId) return null;
  const data = await redis.hGetAll(userKey(userId));
  if (!data || !Object.keys(data).length) return null;
  return data;
}

async function getUserByUsernameOrEmail(identifier) {
  const id = normalize(identifier);
  if (!id) return null;

  let userId = await redis.get(usernameKey(id));
  if (!userId) userId = await redis.get(emailKey(id));
  if (!userId) return null;

  return getUserById(userId);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || "",
    name: user.name || "",
    role: user.role || "agent",
    extension: user.extension || "",
  };
}

function sipPayload(user) {
  return {
    uri: `sip:${user.extension}@${config.sipDomain}`,
    password: user.sipPassword || "",
    ws: config.sipWsUrl,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
      extension: user.extension || "",
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function authRequired(req, res, next) {
  const raw = String(req.headers.authorization || "");
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";

  if (!token) return res.status(401).json({ error: "missing-token" });

  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "invalid-token" });
  }
}

function adminRequired(req, res, next) {
  if (!req.auth || req.auth.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

async function createPortalUser(input) {
  const username = normalize(input.username || input.email);
  const email = normalize(input.email);
  const password = String(input.password || "");
  const role = String(input.role || "agent");
  const extension = String(input.extension || "").trim();
  const name = String(input.name || "").trim();

  // ✅ REQUIRED FIELD VALIDATION
  if (!username || !password || !role || !extension) {
    throw new Error("missing-required-fields");
  }

  // ❌ STRICT EXTENSION VALIDATION
  if (!/^\d{3,6}$/.test(extension)) {
    throw new Error("invalid-extension");
  }

  if (!["admin", "agent", "user"].includes(role)) {
    throw new Error("invalid-role");
  }

  const existsByUsername = await redis.get(usernameKey(username));
  if (existsByUsername) throw new Error("username-exists");

  if (email) {
    const existsByEmail = await redis.get(emailKey(email));
    if (existsByEmail) throw new Error("email-exists");
  }

  const id = input.id || `agent-${extension}`;

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = nowIso();

  // 🔥 SIP PASSWORD SAFETY FIX (CRITICAL)
  const sipPassword =
    input.sipPassword?.trim() ||
    password ||
    crypto.randomBytes(6).toString("hex");

  const user = {
    id,
    username,
    email,
    name,
    role,
    extension,
    passwordHash,
    sipPassword,
    createdAt,
    updatedAt: createdAt,
  };

  await redis.hSet(userKey(id), user);
  await redis.set(usernameKey(username), id);

  if (email) {
    await redis.set(emailKey(email), id);
  }

  await redis.set(`agent:ext:${extension}`, id, { EX: 86400 });

  // FreeSWITCH directory user (SIP provisioning)
  await redis.hSet(`fsdir:user:${extension}`, {
    password: sipPassword,
    userContext: "default",
    callerIdName: name || extension,
    callerIdNumber: extension,
    agentId: id,
  });

  // Agent presence record
  await redis.hSet(`agent:${id}`, {
    extension,
    portalOnline: "false",
    sipRegistered: "false",
    availableInbound: "true",
    availableOutbound: "true",
    inCall: "false",
    lastAssignedAt: String(Date.now()),
  });

  // 🔍 DEBUG LOG (IMPORTANT FOR SIP TROUBLESHOOTING)
  console.log("[SIP][USER_CREATED]", {
    id,
    username,
    extension,
    hasSipPassword: !!sipPassword,
    fsdirKey: `fsdir:user:${extension}`,
  });

  return user;
}

app.get("/healthz", async (_req, res) => {
  const ok = redis.isReady;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    redis: ok,
  });
});

app.post("/auth/login", async (req, res) => {
  const identifier = String(req.body?.username || req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    return res.status(400).json({ error: "missing-credentials" });
  }

  const user = await getUserByUsernameOrEmail(identifier);
  if (!user) return res.status(401).json({ error: "invalid-credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) return res.status(401).json({ error: "invalid-credentials" });

  const token = signToken(user);

  return res.status(200).json({
    token,
    user: publicUser(user),
    sip: sipPayload(user),
  });
});

app.post("/admin/users", authRequired, adminRequired, async (req, res) => {
  try {
    const user = await createPortalUser(req.body || {});
    return res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    const map = {
      "missing-required-fields": 400,
      "invalid-extension": 400,
      "invalid-role": 400,
      "username-exists": 409,
      "email-exists": 409,
    };

    const code = map[err.message] || 500;

    return res.status(code).json({
      error: err.message || "internal-error",
    });
  }
});

app.get("/auth/me", authRequired, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "user-not-found" });

  return res.status(200).json({
    user: publicUser(user),
  });
});

async function seedAdminIfNeeded() {
  if (!config.seedAdminOnStart) return;

  const existing = await redis.get(
    usernameKey(config.seedAdminUsername)
  );

  if (existing) return;

  await createPortalUser({
    id: `agent-${config.seedAdminExtension}`,
    username: config.seedAdminUsername,
    password: config.seedAdminPassword,
    role: "admin",
    extension: config.seedAdminExtension,
    name: config.seedAdminName,
    sipPassword: config.seedAdminPassword,
  });

  console.log("seed admin created", config.seedAdminUsername);
}

async function main() {
  await redis.connect();
  await seedAdminIfNeeded();

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`auth-api listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});