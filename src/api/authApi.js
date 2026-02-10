import { api } from "./client";

export async function signup(payload) {
  const { data } = await api.post("/usuario/users/", payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post("/auth/", payload);
  return data;
}

export async function fetchMe() {
  const { data } = await api.get("/usuario/users/me/");
  return data;
}
