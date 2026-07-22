import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/tag/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: { '/tag/api': 'http://localhost:3003' },
  },
})
