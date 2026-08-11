import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const pagesBase = '/lemon-brains/games/fairy-tale-kingdom/';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? pagesBase : '/',
  resolve: {
    alias: {
      '@knowledge-quest/learning': resolve(
        __dirname,
        '../../packages/learning/src/index.ts'
      ),
      '@knowledge-quest/storage': resolve(
        __dirname,
        '../../packages/storage/src/index.ts'
      ),
    },
  },
  server: {
    port: 4400,
    strictPort: true,
  },
  build: {
    outDir: '../../dist/apps/fairy-tale-kingdom',
    emptyOutDir: true,
  },
}));
