import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/scenario': {
        target: 'http://localhost:8000',
      },
      '/override': {
        target: 'http://localhost:8000',
      },
      '/metrics': {
        target: 'http://localhost:8000',
      },
      '/health': {
        target: 'http://localhost:8000',
      },
    },
  },
})
