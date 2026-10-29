const developmentApiUrl = import.meta.env.DEV ? "http://localhost:5000/api" : "";
const developmentSocketUrl = import.meta.env.DEV ? "http://localhost:5000" : "";
const apiUrl = import.meta.env.VITE_API_URL || developmentApiUrl;
const socketUrl = import.meta.env.VITE_SOCKET_URL || developmentSocketUrl;

if (!apiUrl || !socketUrl) {
  throw new Error("Set VITE_API_URL and VITE_SOCKET_URL before building for production.");
}

export const API_URL = apiUrl.replace(/\/+$/, "");
export const SOCKET_URL = socketUrl.replace(/\/+$/, "");
