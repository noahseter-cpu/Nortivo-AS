import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: "mobile",
  publicDir: "../public",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NEXT_PUBLIC_ANDROID": JSON.stringify("true"),
    "process.env.OFF_STAGING": JSON.stringify(""),
  },
  build: { outDir: "../dist-mobile", emptyOutDir: true, target: "es2022" },
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
});
