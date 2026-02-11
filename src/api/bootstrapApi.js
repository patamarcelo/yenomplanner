// src/api/bootstrapApi.js
import { api } from "./client";

export async function fetchBootstrap() {
    const { data } = await api.get("/bootstrap/");
    return data;
}
