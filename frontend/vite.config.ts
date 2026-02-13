import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true, // CORS 허용
    hmr: {
      clientPort: 443, // Cloudflare Tunnel(HTTPS) 사용 시 필수
      // protocol: 'wss', // HTTPS를 쓴다면 wss로 강제할 수도 있음
    },
    allowedHosts: true, // Allow Cloudflare/Tunnel hosts
    watch: {
      usePolling: true,
    },
    // Proxy for Cloudflare Tunnel compatibility
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        timeout: 3600000, // 60 minutes
        proxyTimeout: 3600000,
      },
      '/uploads': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://voice-backend:8000',
        ws: true,
        changeOrigin: true,
        secure: false, // 내부 통신은 암호화 안 함
      },
    }
  },
})
