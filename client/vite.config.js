import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward every /api request to the Express backend.
      // The backend serves its routes under /api already, so the path is
      // passed through unchanged (no rewrite). Override the target with
      // VITE_API_TARGET when the API runs on a different port.
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5000',
        changeOrigin: true
      }
    },
    watch: {
      // Ignore editor backups, browser profiles and other scratch output.
      // Chokidar otherwise tries to watch their transient, locked files and
      // the dev server exits with EBUSY.
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/*.tmp',
        '**/*.tmpdir/**',
        '**/.*.tmpdir/**',
        '**/_shots/**',
        '**/_preview/**',
        '**/dist/**'
      ]
    }
  }
});
