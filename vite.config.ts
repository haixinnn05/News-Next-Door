import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = `http://localhost:${process.env.PORT ?? 8790}`;

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5190,
    host: true,
    proxy: { "/api": api, "/media": api, "/samples": api },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
