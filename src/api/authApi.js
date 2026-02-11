// src/api/authApi.js
import { api } from "./client";

export async function signup(payload) {
  const { data } = await api.post("/usuario/users/", payload);
  return data;
}

export async function login(payload) {
  console.log("[LOGIN] baseURL:", api.defaults.baseURL);
  console.log("[LOGIN] payload recebido:", payload);

  try {
    const { data } = await api.post("/auth/", payload);
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
