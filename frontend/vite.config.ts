import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    // Proxy for Cloudflare Tunnel compatibility
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://voice-backend:8000',
        ws: true,
        changeOrigin: true,
      },
    }
  },
})
