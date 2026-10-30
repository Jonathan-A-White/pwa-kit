import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'pwa-kit/tips': fileURLToPath(new URL('./packages/tips/src/index.ts', import.meta.url)),
      'pwa-kit/test-preset': fileURLToPath(new URL('./packages/test-preset/src/index.ts', import.meta.url)),
      // the longer specifier first: an alias matches by prefix
      'pwa-kit/tap/testing': fileURLToPath(new URL('./packages/tap/src/testing.ts', import.meta.url)),
      'pwa-kit/tap': fileURLToPath(new URL('./packages/tap/src/index.ts', import.meta.url)),
      // the longer specifier first: an alias matches by prefix
      'pwa-kit/day/eslint': fileURLToPath(new URL('./packages/day/src/eslint.ts', import.meta.url)),
      'pwa-kit/day': fileURLToPath(new URL('./packages/day/src/index.ts', import.meta.url)),
      'pwa-kit/launch-gate': fileURLToPath(new URL('./packages/launch-gate/src/index.ts', import.meta.url)),
      'pwa-kit/app-update': fileURLToPath(new URL('./packages/app-update/src/index.ts', import.meta.url)),
      'pwa-kit/picture-viewer': fileURLToPath(new URL('./packages/picture-viewer/src/index.ts', import.meta.url)),
      'pwa-kit/settings': fileURLToPath(new URL('./packages/settings/src/index.ts', import.meta.url)),
      'pwa-kit/requests': fileURLToPath(new URL('./packages/requests/src/index.ts', import.meta.url)),
      'pwa-kit/push': fileURLToPath(new URL('./packages/push/src/index.ts', import.meta.url)),
      'pwa-kit/alive': fileURLToPath(new URL('./packages/alive/src/index.ts', import.meta.url)),
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
