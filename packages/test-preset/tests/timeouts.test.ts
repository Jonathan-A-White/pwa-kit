// The numbers an app's vitest and Playwright configs take: sized for a loaded host (mw-eo6dj9).
import { describe, expect, it } from 'vitest';
import { ASYNC_WAIT_MS, HOOK_TIMEOUT_MS, playwrightTimeouts, vitestTimeouts } from '../src/timeouts.js';

describe('vitestTimeouts', () => {
  it('gives a hook at least 120 s and a test at least 40 s', () => {
    expect(vitestTimeouts.hookTimeout).toBeGreaterThanOrEqual(120_000);
    expect(vitestTimeouts.testTimeout).toBeGreaterThanOrEqual(40_000);
  });

  it('gives expect.poll 20 s, under the test timeout', () => {
    expect(vitestTimeouts.expect.poll.timeout).toBe(20_000);
    expect(vitestTimeouts.expect.poll.timeout).toBeLessThan(vitestTimeouts.testTimeout);
  });
});

describe('the testing-library wait and the hook budget', () => {
  it('waits 10 s for findBy* and waitFor, well under the test timeout', () => {
    expect(ASYNC_WAIT_MS).toBe(10_000);
    expect(ASYNC_WAIT_MS).toBeLessThan(vitestTimeouts.testTimeout);
  });

  it('gives a build, a removal or a spawn 120 s, as hookTimeout does', () => {
    expect(HOOK_TIMEOUT_MS).toBe(120_000);
    expect(HOOK_TIMEOUT_MS).toBe(vitestTimeouts.hookTimeout);
  });
});

describe('playwrightTimeouts', () => {
  it('gives a test 60 s and expect() 20 s', () => {
    expect(playwrightTimeouts).toEqual({ timeout: 60_000, expect: { timeout: 20_000 } });
  });
});
