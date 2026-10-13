import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The desktop app (src-tauri/tauri.conf.json devUrl) expects exactly :5173.
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  clearScreen: false,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    pool: 'vmThreads',
  },
})
