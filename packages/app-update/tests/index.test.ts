// The entry point: what pwa-kit/app-update exports.
import { describe, expect, it } from 'vitest';
import * as appUpdate from '../src/index.js';

describe('pwa-kit/app-update', () => {
  it('exports the state machine, its hook, getUpdateState and the two timings', () => {
    expect(Object.keys(appUpdate).sort()).toEqual([
      'TAKE_OVER_PATIENCE_MS',
      'UPDATE_CHECK_EVERY_MS',
      'applyUpdate',
      'getUpdateState',
      'startAppUpdates',
      'useUpdateState',
    ]);
  });

  it('has the timings the apps were built on', () => {
    expect(appUpdate.UPDATE_CHECK_EVERY_MS).toBe(30 * 60_000);
    expect(appUpdate.TAKE_OVER_PATIENCE_MS).toBe(10_000);
  });
});
