import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    // Tailwind is handled by @tailwindcss/vite. Disable PostCSS config
    // discovery so parent-directory configs are not picked up.
    postcss: { plugins: [] },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        timeout: 900_000,
        proxyTimeout: 900_000,
      },
    },
  },
})
