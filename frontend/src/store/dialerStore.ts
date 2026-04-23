import { create } from "zustand";

type CallState = "idle" | "ringing" | "in-call";

interface DialerState {
  sipRegistered: boolean;
  wsConnected: boolean;
  available: boolean;
  activeCall: Record<string, unknown> | null;
  callState: CallState;
  incomingSession: any | null;
  callerNumber: string;

  setSipRegistered: (v: boolean) => void;
  setWsConnected: (v: boolean) => void;
  setAvailable: (v: boolean) => void;
  setActiveCall: (call: Record<string, unknown> | null) => void;
  setCallState: (state: CallState) => void;
  setIncomingSession: (session: any | null) => void;
  setCallerNumber: (value: string) => void;
  clearCurrentCall: () => void;
}

export const useDialerStore = create<DialerState>((set) => ({
  sipRegistered: false,
  wsConnected: false,
  available: true,
  activeCall: null,
  callState: "idle",
  incomingSession: null,
  callerNumber: "",

  setSipRegistered: (v) => set({ sipRegistered: v }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setAvailable: (v) => set({ available: v }),
  setActiveCall: (call) => set({ activeCall: call }),
  setCallState: (state) => set({ callState: state }),
  setIncomingSession: (session) => set({ incomingSession: session }),
  setCallerNumber: (value) => set({ callerNumber: value }),
  clearCurrentCall: () =>
    set({
      callState: "idle",
      incomingSession: null,
      callerNumber: "",
      activeCall: null,
    }),
}));
