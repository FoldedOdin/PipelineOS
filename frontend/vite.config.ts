import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://api:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://api:3001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
