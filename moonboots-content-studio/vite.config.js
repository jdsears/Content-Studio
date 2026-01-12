import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: process.env.PORT || 3000,
    host: true,
    allowedHosts: ['localhost', '.railway.app', '.up.railway.app']
  }
})
