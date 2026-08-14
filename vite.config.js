import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/OBR-Improved-Initiative/",
  server: {
    host: true,
    cors: true,
    proxy: {
      "/ii-api": {
        target: "https://improvedinitiative.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ii-api/, ""),
      },
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Private-Network": "true",
    },
  },
  preview: {
    host: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Private-Network": "true",
    },
  },
});
