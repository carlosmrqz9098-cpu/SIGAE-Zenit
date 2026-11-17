import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, todo lo que empiece con /api se manda al backend (FastAPI) en el puerto 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
