import { describe, expect, it } from 'vitest';
import { findUncovered } from './typecheck-all.mjs';

const root = new Set(['/r/packages/day/src/index.ts', '/r/packages/day/tests/a.test.ts']);

describe('typecheck-all', () => {
  it('passes a package with its own tsconfig.json and one the root tsconfig lists', () => {
    const packages = [
      { name: 'day', dir: '/r/packages/day', hasTsconfig: false, tsFiles: ['/r/packages/day/src/index.ts', '/r/packages/day/tests/a.test.ts'] },
      { name: 'tap', dir: '/r/packages/tap', hasTsconfig: true, tsFiles: ['/r/packages/tap/src/index.ts'] },
    ];
    expect(findUncovered(packages, root)).toEqual([]);
  });

  it('names a package with TypeScript sources that has no tsconfig.json and is not in the root run', () => {
    const packages = [
      { name: 'outbox', dir: '/r/packages/outbox', hasTsconfig: false, tsFiles: ['/r/packages/outbox/src/index.ts'] },
    ];
    expect(findUncovered(packages, root)).toEqual([{ name: 'outbox', files: ['/r/packages/outbox/src/index.ts'] }]);
  });

  it('names only the files the root run misses in a package with no tsconfig.json', () => {
    const packages = [
      { name: 'day', dir: '/r/packages/day', hasTsconfig: false, tsFiles: ['/r/packages/day/src/index.ts', '/r/packages/day/src/new.tsx'] },
    ];
    expect(findUncovered(packages, root)).toEqual([{ name: 'day', files: ['/r/packages/day/src/new.tsx'] }]);
  });

  it('ignores a package with no TypeScript sources', () => {
    expect(findUncovered([{ name: 'css', dir: '/r/packages/css', hasTsconfig: false, tsFiles: [] }], root)).toEqual([]);
  });
});
