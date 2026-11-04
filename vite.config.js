import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'fix-vite-client-env',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] === '/node_modules/vite/dist/client/env.mjs') {
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/javascript')
            response.end('const defines = {};')
            return
          }
          next()
        })
      },
    },
    react(),
  ],
  envDir: 'serverless-side',
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})