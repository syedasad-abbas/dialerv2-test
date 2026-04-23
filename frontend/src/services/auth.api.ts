import api from "./api";

export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    name?: string;
    email?: string;
    role: "admin" | "agent" | "user";
    extension?: string;
  };
  token: string;
  sip?: {
    uri: string;
    password: string;
    ws: string;
  };
}

export const loginApi = (data: LoginRequest) =>
  api.post<LoginResponse>("/auth/login", data);
