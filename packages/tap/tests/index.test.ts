// The entry points: what pwa-kit/tap and pwa-kit/tap/testing export.
import { describe, expect, it } from 'vitest';
import * as tap from '../src/index.js';
import * as testing from '../src/testing.js';

describe('pwa-kit/tap', () => {
  it('exports the guard, the hooks and the seam', () => {
    expect(Object.keys(tap).sort()).toEqual(['TAP_SETTLE_MS', 'createTapGuard', 'tapSettings', 'useSettled', 'useTapGuard']);
    expect(tap.TAP_SETTLE_MS).toBe(300);
    expect(tap.tapSettings.ms).toBe(300);
  });
});

describe('pwa-kit/tap/testing', () => {
  it('exports the two helpers', () => {
    expect(Object.keys(testing).sort()).toEqual(['twoTaps', 'twoTapsAt']);
  });
});
