import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from "@tailwindcss/vite"

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    if (!env.VITE_API_URL || !env.VITE_SOCKET_URL) {
      throw new Error("VITE_API_URL and VITE_SOCKET_URL are required for production builds.");
    }
  }

  return {
    plugins: [react(), tailwindcss()],
  };
})
