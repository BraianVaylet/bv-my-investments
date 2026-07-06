import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // bundlear el source TS de shared (el dist CJS no expone named exports para Rollup)
    alias: { '@bv/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
