import axios from "axios";

const isDev = import.meta.env.DEV;


export const api = axios.create({
    baseURL: isDev
    ? "http://localhost:8080"
    : import.meta.env.VITE_API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("authToken");
    if (token) config.headers.Authorization = `Token ${token}`;
    return config;
});
