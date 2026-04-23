import axios from "axios";
import { useAuthStore } from "../store/authStore";

const trace = () =>
  `api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000",
  timeout: 15000,
});

// =========================
// REQUEST INTERCEPTOR
// =========================
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  const traceId = trace();

  // attach traceId for debugging across logs
  config.headers["x-trace-id"] = traceId;

  console.log("[API][REQUEST]", {
    traceId,
    url: config.url,
    method: config.method,
  });

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// =========================
// RESPONSE INTERCEPTOR
// =========================
api.interceptors.response.use(
  (response) => {
    const traceId = response.config.headers?.["x-trace-id"];

    console.log("[API][RESPONSE]", {
      traceId,
      url: response.config.url,
      status: response.status,
      hasData: !!response.data,
      hasSip: !!response.data?.sip,
      sipShape: response.data?.sip
        ? {
            uri: !!response.data.sip.uri,
            ws: !!response.data.sip.ws,
            password: !!response.data.sip.password,
          }
        : null,
    });

    return response;
  },
  (error) => {
    const traceId = error?.config?.headers?.["x-trace-id"];

    console.log("[API][ERROR]", {
      traceId,
      url: error?.config?.url,
      status: error?.response?.status,
      message: error?.message,
      data: error?.response?.data,
    });

    if (error?.response?.status === 401) {
      console.log("[API][AUTH_401_LOGOUT]", { traceId });
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);

export default api;