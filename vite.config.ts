import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  cloudflare: false,
  vite: {
    server: {
      port: 3001,
      allowedHosts: [".trycloudflare.com"],
      hmr: {
        host: "localhost",
        protocol: "ws",
        port: 3002,
      },
    },
    plugins: [
      nitro({ preset: process.env.VERCEL ? "vercel" : "node-server" })
    ]
  },
});
