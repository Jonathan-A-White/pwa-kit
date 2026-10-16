import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

describe('@pwa-kit/test-preset', () => {
  it('exports the timeouts, the timing filters and settleAfterTeardown', () => {
    expect(Object.keys(pkg).sort()).toEqual(
      ['ASYNC_WAIT_MS', 'HOOK_TIMEOUT_MS', 'playwrightTimeouts', 'playwrightTimingFilter', 'settleAfterTeardown', 'timingFilter', 'vitestTimeouts'].sort(),
    );
    expect(pkg.timingFilter).toBeTypeOf('function');
    expect(pkg.playwrightTimingFilter).toBeTypeOf('function');
    expect(pkg.settleAfterTeardown).toBeTypeOf('function');
  });
});
