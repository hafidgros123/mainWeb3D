import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: 'serverless-side',
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})