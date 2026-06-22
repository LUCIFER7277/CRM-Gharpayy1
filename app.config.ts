import { defineConfig } from '@tanstack/start/config'
export default defineConfig({
  server: {
    preset: process.env.VERCEL ? 'vercel' : 'node-server'
  }
})
