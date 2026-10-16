// pwa-kit/day/eslint: the no-utc-day rule, through ESLint's RuleTester, and the config object an app spreads.
import { RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';
import dayLint, { config, plugin } from '../src/eslint.js';

RuleTester.describe = describe;
RuleTester.it = it;

const rule = plugin.rules['no-utc-day'];
const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });

tester.run('no-utc-day', rule, {
  valid: [
    'd.toISOString()',
    "const stamp = d.toISOString(); send(stamp)",
    'localDay()',
    'localDay(d)',
    "new Date('2026-10-14T12:00:00Z')",
    "new Date('2026-10-14T12:00:00')",
    'new Date(2026, 9, 14)',
    'new Date(text)',
    'new Date()',
    "dayStart('2026-10-14')",
    "text.split('T')[0]",
    'text.slice(0, 10)',
    "d.toISOString().split('-')",
    'd.toISOString().slice(0, 4)',
    'd.toISOString().slice(11, 19)',
    'd.toISOString().slice(0, n)',
    'd.toISOString().replace("Z", "")',
    "new Date('not a day')",
    "other('2026-10-14')",
  ],
  invalid: [
    { code: "const day = d.toISOString().split('T')[0];", errors: [{ messageId: 'utcDayKey' }] },
    { code: 'const day = d.toISOString().split("T")[0];', errors: [{ messageId: 'utcDayKey' }] },
    { code: "const [day] = new Date().toISOString().split('T');", errors: [{ messageId: 'utcDayKey' }] },
    { code: 'const day = d.toISOString().slice(0, 10);', errors: [{ messageId: 'utcDayKey' }] },
    { code: 'const day = d.toISOString().substring(0, 10);', errors: [{ messageId: 'utcDayKey' }] },
    { code: 'const day = d.toISOString().substr(0, 10);', errors: [{ messageId: 'utcDayKey' }] },
    { code: "const day = new Date(Date.now()).toISOString().slice(0, 10);", errors: [{ messageId: 'utcDayKey' }] },
    { code: "const day = d?.toISOString().slice(0, 10);", errors: [{ messageId: 'utcDayKey' }] },
    { code: "const d = new Date('2026-10-14');", errors: [{ messageId: 'utcDayParse' }] },
    { code: 'const d = new Date("2026-10-14");', errors: [{ messageId: 'utcDayParse' }] },
    { code: 'const d = new Date(`2026-10-14`);', errors: [{ messageId: 'utcDayParse' }] },
    {
      code: "const a = d.toISOString().slice(0, 10), b = new Date('2026-01-01');",
      errors: [{ messageId: 'utcDayKey' }, { messageId: 'utcDayParse' }],
    },
  ],
});

describe('the messages', () => {
  it('name localDay and dayStart', () => {
    expect(rule.meta?.messages?.utcDayKey).toContain('localDay');
    expect(rule.meta?.messages?.utcDayParse).toContain('dayStart');
  });
});

describe('the config object', () => {
  it('registers the plugin pwa-kit-day and turns no-utc-day on as an error', () => {
    expect(Object.keys(config.plugins)).toEqual(['pwa-kit-day']);
    expect(config.plugins['pwa-kit-day']).toBe(plugin);
    expect(config.rules).toEqual({ 'pwa-kit-day/no-utc-day': 'error' });
  });

  it('is the default export too, so an app can import it by any name', () => {
    expect(dayLint).toBe(config);
  });

  it('is a plain object an app can spread and add its own files to', () => {
    const mine = { ...config, files: ['src/**/*.ts'] };
    expect(mine.rules['pwa-kit-day/no-utc-day']).toBe('error');
  });
});
