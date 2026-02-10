import axios from "axios";

const isDev = import.meta.env.DEV;

const http = axios.create({
  baseURL: isDev
    ? "http://localhost:8080"
    : import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default http;
