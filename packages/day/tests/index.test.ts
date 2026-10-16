// The entry points: what pwa-kit/day and pwa-kit/day/eslint export.
import { describe, expect, it } from 'vitest';
import * as day from '../src/index.js';
import * as lint from '../src/eslint.js';

describe('pwa-kit/day', () => {
  it('exports the four functions and the error', () => {
    expect(Object.keys(day).sort()).toEqual(['DayError', 'addDays', 'dayStart', 'isDay', 'localDay']);
    expect(day.localDay).toBeTypeOf('function');
    expect(day.DayError).toBeTypeOf('function');
  });
});

describe('pwa-kit/day/eslint', () => {
  it('exports the plugin, the config and the config as default', () => {
    expect(Object.keys(lint).sort()).toEqual(['config', 'default', 'plugin']);
    expect(Object.keys(lint.plugin.rules)).toEqual(['no-utc-day']);
  });
});
