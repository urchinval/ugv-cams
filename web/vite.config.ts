import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite on :5173 proxies /api to the Node backend on :8080.
// Prod: the backend serves dist/ itself, so the UI and /api share an origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
