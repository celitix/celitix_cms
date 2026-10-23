import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Fixed port 5173 — the backend's CORS allow-list includes http://localhost:5173.
    // strictPort avoids silently falling back to 5174 (which CORS would block).
    port: 5173,
    strictPort: true,
  },
})
