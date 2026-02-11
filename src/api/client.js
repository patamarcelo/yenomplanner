import axios from "axios";

const isDev = import.meta.env.DEV;

const baseURL = isDev ? "http://localhost:8080" : import.meta.env.VITE_API_BASE_URL;

console.log("[API] isDev:", isDev);
console.log("[API] baseURL:", baseURL);

export const api = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const url = err?.config?.baseURL ? err.config.baseURL + err.config.url : err?.config?.url;
        console.log("[API ERROR]", err?.response?.status, url);
        console.log("[API ERROR] response.data:", err?.response?.data);
        return Promise.reject(err);
    }
);
