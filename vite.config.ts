import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/trakt': {
        target: 'https://api.trakt.tv',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/trakt/, ''),
        headers: {
          'trakt-api-version': '2'
        }
      }
    }
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
