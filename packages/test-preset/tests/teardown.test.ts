// settleAfterTeardown: what a promise that settles after the page is gone raises (mw-ev7oyy.21).
import { describe, expect, it } from 'vitest';
import { settleAfterTeardown } from '../src/teardown.js';

describe('settleAfterTeardown', () => {
  it('returns nothing when settle raises nothing', async () => {
    expect(await settleAfterTeardown(() => {})).toEqual([]);
  });

  it('returns the rejection a settled promise raised, once the microtasks are drained', async () => {
    const boom = new Error('boom');
    const raised = await settleAfterTeardown(() => void Promise.reject(boom));
    expect(raised).toEqual([boom]);
  });

  it('takes window away while settle runs and puts it back after', async () => {
    const fake = { fake: true };
    Object.defineProperty(globalThis, 'window', { value: fake, configurable: true, writable: true });
    try {
      let during: unknown = 'unset';
      await settleAfterTeardown(() => {
        during = (globalThis as { window?: unknown }).window;
      });
      expect(during).toBeUndefined();
      expect((globalThis as { window?: unknown }).window).toBe(fake);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it('leaves no window behind when there was none', async () => {
    await settleAfterTeardown(() => {});
    expect('window' in globalThis).toBe(false);
  });
});
