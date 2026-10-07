import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The single .env file lives in the repo root (only VITE_* variables reach the client).
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: {
    port: 5173,
    strictPort: true,
  },
});
