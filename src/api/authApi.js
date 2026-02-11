import { api } from "./client";

export async function login(payload) {
  console.log("[LOGIN] payload recebido:", payload);
  console.log("[LOGIN] POST:", (api.defaults.baseURL || "") + "/auth/");

  try {
    const { data } = await api.post("/auth/", payload);
    console.log("[LOGIN] OK response:", data);
    return data;
  } catch (err) {
    console.log("[LOGIN] ERRO status:", err?.response?.status);
    console.log("[LOGIN] ERRO response.data:", err?.response?.data);
    console.log("[LOGIN] ERRO message:", err?.message);
    throw err;
  }
}
