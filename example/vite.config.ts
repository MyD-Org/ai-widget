import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Playground del widget. Importa el widget desde src/ (HMR sobre el source).
// Proxy a ai-api (localhost:3000) para que /v1 y /demo sean same-origin → sin CORS.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/v1': { target: 'http://localhost:3000', changeOrigin: true },
      '/demo': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
