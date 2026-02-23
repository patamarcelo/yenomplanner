// src/api/bootstrapApi.js
import http from "./http";

export async function fetchBootstrap() {
    const { data } = await http.get("yenomplanner/bootstrap/");
    return data;
}
