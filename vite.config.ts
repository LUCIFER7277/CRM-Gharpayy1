import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  cloudflare: false,
  vite: {
    server: {
      port: 3001,
      allowedHosts: [".trycloudflare.com"],
    },
    plugins: [
      nitro({ preset: "node-server" })
    ]
  },
});
