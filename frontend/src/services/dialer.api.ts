import { useAuthStore } from "../store/authStore";
import { useDialerStore } from "../store/dialerStore";

let ws: WebSocket | null = null;

export const connectDialerWS = () => {
  const url =
    import.meta.env.VITE_PORTAL_WS_URL || "ws://127.0.0.1:18081";
  const { user } = useAuthStore.getState();
  if (!user || !url) {
    console.log("[DIALER_WS][SKIP_CONNECT]", {
      hasUser: !!user,
      hasUrl: !!url,
    });
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log("[DIALER_WS][ALREADY_ACTIVE]", {
      readyState: ws.readyState,
      url,
    });
    return;
  }
  console.log("[DIALER_WS][CONNECTING]", {
    url,
    agentId: user.id,
    extension: user.extension,
  });
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[DIALER_WS][OPEN]", { url });
    useDialerStore.getState().setWsConnected(true);
    sendPresence();
  };

  ws.onclose = (event) => {
    console.log("[DIALER_WS][CLOSE]", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
    useDialerStore.getState().setWsConnected(false);
  };

  ws.onerror = (event) => {
    console.log("[DIALER_WS][ERROR]", { eventType: event.type });
    useDialerStore.getState().setWsConnected(false);
  };

  ws.onmessage = (event) => {
    let data: any;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type === "CALL_ASSIGNED") {
      console.log("[DIALER_WS][CALL_ASSIGNED]", { call: data.call });
      useDialerStore.getState().setActiveCall(data.call);
    }

    if (data.type === "CALL_ENDED") {
      console.log("[DIALER_WS][CALL_ENDED]");
      useDialerStore.getState().setActiveCall(null);
    }
  };
};

export const sendPresence = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log("[DIALER_WS][PRESENCE_SKIP_SOCKET_NOT_OPEN]", {
      hasWs: !!ws,
      readyState: ws?.readyState ?? null,
    });
    return;
  }

  const { user } = useAuthStore.getState();
  const { sipRegistered, available } = useDialerStore.getState();
  if (!user) {
    console.log("[DIALER_WS][PRESENCE_SKIP_NO_USER]");
    return;
  }

  console.log("[DIALER_WS][SEND_PRESENCE]", {
    agentId: user.id,
    extension: user.extension,
    sipRegistered,
    available,
  });

  ws.send(
    JSON.stringify({
      type: "agent_presence",
      agentId: user?.id,
      extension: user?.extension,
      sipRegistered,
      availableInbound: available,
      availableOutbound: available,
    })
  );
};

export const disconnectDialerWS = () => {
  if (ws) {
    console.log("[DIALER_WS][MANUAL_CLOSE]");
    ws.close();
    ws = null;
  }
  useDialerStore.getState().setWsConnected(false);
};
