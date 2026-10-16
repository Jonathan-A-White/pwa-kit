import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
// pwa-kit's own rule no-utc-day against the UTC day, from the built package (npm ci builds it before lint runs)
import dayLint from './packages/day/dist/eslint.js';

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules', 'examples/**/dist']),
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  dayLint,
]);
