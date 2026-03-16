import api from "./http";

export async function signup(payload) {
  const { data } = await api.post("/usuario/users/", payload);
  return data;
}

export async function login(payload) {
  console.log("[LOGIN] baseURL:", api.defaults.baseURL);
  console.log("[LOGIN] payload recebido:", payload);

  try {
    const { data } = await api.post("usuario/auth/login/", payload);
    console.log("[LOGIN] OK:", data);
    return data;
  } catch (err) {
    console.log("[LOGIN] ERRO status:", err?.response?.status);
    console.log("[LOGIN] ERRO data:", err?.response?.data);
    throw err;
  }
}

export async function fetchMe() {
  const { data } = await api.get("/usuario/users/me/");
  return data;
}

export async function requestPasswordReset({ email }) {
  const { data } = await api.post("/auth/password/reset/", {
    email: String(email || "").trim().toLowerCase(),
  });
  return data;
}

export async function confirmPasswordReset({ uid, token, new_password }) {
  console.log("[RESET CONFIRM] baseURL:", api.defaults.baseURL);

  try {
    const { data } = await api.post("/auth/password/reset/confirm/", {
      uid,
      token,
      new_password,
    });
    return data;
  } catch (err) {
    console.log("[RESET CONFIRM] status:", err?.response?.status);
    console.log("[RESET CONFIRM] data:", err?.response?.data);
    throw err;
  }
}