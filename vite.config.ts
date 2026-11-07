import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const api = env.VITE_API_ORIGIN || "http://127.0.0.1:4000";
  const appOrigin = env.VITE_APP_ORIGIN || "http://127.0.0.1:3000";

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT || 5174),
      proxy: {
        "/api": { target: api, changeOrigin: true },
      },
    },
    define: {
      __CV_APP_ORIGIN__: JSON.stringify(appOrigin),
    },
  };
});
