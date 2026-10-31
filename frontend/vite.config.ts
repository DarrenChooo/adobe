import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: the page runs on :5173 and forwards API and file calls to FastAPI on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/files": "http://127.0.0.1:8000",
    },
  },
});
