import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'pwa-kit/tips': fileURLToPath(new URL('./packages/tips/src/index.ts', import.meta.url)),
      'pwa-kit/whats-new': fileURLToPath(new URL('./packages/whats-new/src/index.ts', import.meta.url)),
    },
  },
  // whats-new's .tsx: React's automatic JSX runtime, as its tsconfig says (jsx: react-jsx)
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['packages/*/tests/**/*.test.{ts,tsx}', 'scripts/*.test.mjs'],
  },
});
