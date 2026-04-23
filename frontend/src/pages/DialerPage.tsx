import { useEffect, useMemo, useState } from "react";
import { sendPresence } from "../services/dialer.api";
import {
  answerIncomingCall,
  hangupCurrentCall,
  rejectIncomingCall,
  startSIP,
} from "../services/sip";
import { useAuthStore } from "../store/authStore";
import { useDialerStore } from "../store/dialerStore";

export default function DialerPage() {
  const {
    wsConnected,
    sipRegistered,
    available,
    activeCall,
    callState,
    callerNumber,
    setAvailable,
  } = useDialerStore();

  const sipConfig = useAuthStore((s) => s.sipConfig);

  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const traceId = `dialer-${Date.now()}`;

  // =========================
  // SIP START (FIXED - NO LOOP)
  // =========================
  useEffect(() => {
    if (!sipConfig?.uri || !sipConfig?.password || !sipConfig?.wsServers) {
      console.log("[DIALER][NO_SIP_CONFIG]", { traceId });
      return;
    }

    // 🚨 IMPORTANT: only start SIP ONCE on mount
    console.log("[DIALER][START_SIP_REQUEST]", {
      traceId,
      uri: sipConfig.uri,
      wsServers: sipConfig.wsServers,
      sipRegistered,
    });

    startSIP(sipConfig);
  }, []);

  // =========================
  // PRESENCE CONTROL (FIXED)
  // =========================
  useEffect(() => {
    if (!wsConnected) {
      console.log("[DIALER][WS_NOT_CONNECTED]");
      return;
    }

    if (!sipRegistered) {
      console.log("[DIALER][PRESENCE_BLOCKED_NO_SIP]", { traceId });
      return;
    }

    console.log("[DIALER][SENDING_INITIAL_PRESENCE]", { traceId });

    sendPresence();
  }, [wsConnected, sipRegistered]);

  // =========================
  // CALL TIMER
  // =========================
  useEffect(() => {
    if (callState === "in-call") {
      setCallStartedAt(Date.now());
    } else {
      setCallStartedAt(null);
      setElapsedSec(0);
    }
  }, [callState]);

  useEffect(() => {
    if (!callStartedAt) return;

    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - callStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(t);
  }, [callStartedAt]);

  // =========================
  // TOGGLE AVAILABILITY
  // =========================
  const toggleAvailability = () => {
    setAvailable(!available);

    console.log("[DIALER][AVAILABILITY_CHANGED]", {
      traceId,
      available: !available,
    });

    setTimeout(() => {
      sendPresence();
    }, 0);
  };

  const formattedDuration = useMemo(() => {
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const ss = String(elapsedSec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedSec]);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>Dialer</h2>

      <p>WS: {wsConnected ? "connected" : "disconnected"}</p>
      <p>SIP: {sipRegistered ? "registered" : "not registered"}</p>

      <button onClick={toggleAvailability} style={{ padding: 10 }}>
        {available ? "Set Unavailable" : "Set Available"}
      </button>

      {callState === "ringing" && (
        <div style={{ marginTop: 20, border: "1px solid #ddd", padding: 16 }}>
          <h3>Incoming Call</h3>
          <p>From: {callerNumber || "Unknown"}</p>

          <button onClick={answerIncomingCall} style={{ padding: 10, marginRight: 8 }}>
            Answer
          </button>

          <button onClick={rejectIncomingCall} style={{ padding: 10 }}>
            Reject
          </button>
        </div>
      )}

      {callState === "in-call" && (
        <div style={{ marginTop: 20, border: "1px solid #ddd", padding: 16 }}>
          <h3>In Call</h3>
          <p>From: {callerNumber || "Unknown"}</p>
          <p>Duration: {formattedDuration}</p>

          <button onClick={hangupCurrentCall} style={{ padding: 10 }}>
            Hangup
          </button>
        </div>
      )}

      {callState === "idle" && (
        <p style={{ marginTop: 20 }}>Waiting for calls...</p>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Active Call</h3>
        <pre>
          {activeCall
            ? JSON.stringify(activeCall, null, 2)
            : "No active call"}
        </pre>
      </div>
    </div>
  );
}