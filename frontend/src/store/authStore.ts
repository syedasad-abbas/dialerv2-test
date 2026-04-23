import { create } from "zustand";

export type UserRole = "admin" | "agent" | "user";

export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  role: UserRole;
  extension?: string;
}

export interface SipConfig {
  uri: string;
  password: string;
  wsServers: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  sipConfig: SipConfig | null;
  setAuth: (user: AuthUser, token: string) => void;
  setSipConfig: (config: SipConfig | null) => void;
  logout: () => void;
}

const TOKEN_KEY = "dialerv2_token";
const USER_KEY = "dialerv2_user";
const SIP_KEY = "dialerv2_sip";

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function readSipConfig(): SipConfig | null {
  try {
    const raw = localStorage.getItem(SIP_KEY);
    return raw ? (JSON.parse(raw) as SipConfig) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readUser(),
  token: localStorage.getItem(TOKEN_KEY),
  sipConfig: readSipConfig(),

  setAuth: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, token });
  },

  setSipConfig: (config) => {
    if (!config) {
      localStorage.removeItem(SIP_KEY);
      set({ sipConfig: null });
      return;
    }
    localStorage.setItem(SIP_KEY, JSON.stringify(config));
    set({ sipConfig: config });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SIP_KEY);
    set({ user: null, token: null, sipConfig: null });
  },
}));
