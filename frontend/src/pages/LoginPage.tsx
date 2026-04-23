import { loginApi } from "../services/auth.api";
import { connectDialerWS, sendPresence } from "../services/dialer.api";
import { startSIP } from "../services/sip";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // ✅ TRACE ID (GLOBAL FOR THIS LOGIN FLOW)
    const traceId = `sip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log("[LOGIN][START]", { traceId, username });

    try {
      const res = await loginApi({ username, password });
      const { user, token, sip } = res.data;

      // ✅ LOGIN SUCCESS TRACE
      console.log("[LOGIN][SUCCESS]", {
        traceId,
        userId: user?.id,
        extension: user?.extension,
        hasSip: !!sip,
        sipUri: sip?.uri,
        sipWs: sip?.ws,
        hasSipPassword: !!sip?.password, // never log actual password
      });

      const auth = useAuthStore.getState();
      auth.setAuth(user, token);

      connectDialerWS();
      setTimeout(() => sendPresence(), 0);

      // ✅ SIP CONFIG + START TRACE
      if (sip?.uri && sip?.password && sip?.ws) {
        const cfg = {
          uri: sip.uri,
          password: sip.password,
          wsServers: sip.ws,
        };

        console.log("[LOGIN][SIP_CONFIG_VALID]", {
          traceId,
          uri: cfg.uri,
          wsServers: cfg.wsServers,
          hasPassword: !!cfg.password,
        });

        auth.setSipConfig(cfg);

        console.log("[LOGIN][CALLING_startSIP]", {
          traceId,
          uri: cfg.uri,
          wsServers: cfg.wsServers,
        });

        startSIP(cfg);
      } else {
        console.log("[LOGIN][SIP_CONFIG_MISSING]", {
          traceId,
          sipExists: !!sip,
          uri: sip?.uri,
          ws: sip?.ws,
          hasPassword: !!sip?.password,
        });

        auth.setSipConfig(null);
      }

      // ✅ NAVIGATION TRACE
      console.log("[LOGIN][NAVIGATE]", { traceId, to: "/portal" });
      navigate("/portal");
    } catch (err: any) {
      console.log("[LOGIN][ERROR]", {
        traceId,
        message: err?.message,
        responseStatus: err?.response?.status,
      });
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h2>Portal Login</h2>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Username or Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        {error ? <p style={{ color: "red" }}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 10 }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}