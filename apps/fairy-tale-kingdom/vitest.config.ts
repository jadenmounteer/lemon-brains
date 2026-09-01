import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
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
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/game/core/**', 'src/marketplace/**', 'src/kingdom/**'],
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    },
  },
});
