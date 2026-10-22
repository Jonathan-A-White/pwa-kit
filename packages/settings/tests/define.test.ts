import { describe, expect, it } from 'vitest';
import { defineSetting, isAllowed } from '../src/index.js';

const onOff = { kind: 'choice', values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] } as const;
const base = { section: 'look', label: 'Thing', hint: 'A thing.' };

describe('defineSetting', () => {
  it('rejects a default outside the choices', () => {
    expect(() => defineSetting({ ...base, key: 'a', default: 'maybe', allowed: onOff })).toThrow(/a.*default/);
  });

  it('rejects a numeric default outside min and max, or not a number at all', () => {
    const allowed = { kind: 'number', min: 1, max: 5, step: 1 } as const;
    const parse = (raw: unknown): number => Number(raw);
    expect(() => defineSetting({ ...base, key: 'n', default: 6, parse, allowed })).toThrow(/default/);
    expect(() => defineSetting({ ...base, key: 'n', default: 0, parse, allowed })).toThrow(/default/);
    expect(() => defineSetting({ ...base, key: 'n', default: Number.NaN, parse, allowed })).toThrow(/default/);
    expect(() => defineSetting({ ...base, key: 'n', default: 'three', parse: String, allowed })).toThrow(/default/);
    expect(defineSetting({ ...base, key: 'n', default: 5, parse, allowed }).default).toBe(5);
  });

  it('rejects a text default the setting would not accept', () => {
    const allowed = { kind: 'text', valid: (v: string) => /^\d{4}$/.test(v), example: '2026' } as const;
    expect(() => defineSetting({ ...base, key: 't', default: 'abc', parse: String, allowed })).toThrow(/default/);
    expect(defineSetting({ ...base, key: 't', default: '2026', parse: String, allowed }).default).toBe('2026');
  });

  it('rejects an empty key, name or hint, and a choice with no values', () => {
    expect(() => defineSetting({ ...base, key: '', default: 'on', allowed: onOff })).toThrow(/key/);
    expect(() => defineSetting({ ...base, label: '', key: 'a', default: 'on', allowed: onOff })).toThrow(/label/);
    expect(() => defineSetting({ ...base, hint: ' ', key: 'a', default: 'on', allowed: onOff })).toThrow(/hint/);
    expect(() => defineSetting({ ...base, key: 'a', default: 'on', allowed: { kind: 'choice', values: [] } })).toThrow(/values/);
  });

  it('reads a saved choice back, or the default when the saved value is not one of the choices', () => {
    const def = defineSetting({ ...base, key: 'a', default: 'off', allowed: onOff });
    expect(def.parse('on')).toBe('on');
    expect(def.parse('maybe')).toBe('off');
    expect(def.parse(undefined)).toBe('off');
    expect(def.parse(3)).toBe('off');
  });

  it('needs its own parse for a number or text setting, and uses it', () => {
    const allowed = { kind: 'number', min: 1, max: 5, step: 1 } as const;
    expect(() => defineSetting({ ...base, key: 'n', default: 2, allowed })).toThrow(/needs its own parse/);
    const def = defineSetting({ ...base, key: 'n', default: 2, parse: (raw) => (Number(raw) >= 1 && Number(raw) <= 5 ? Number(raw) : 2), allowed });
    expect(def.parse('4')).toBe(4);
    expect(def.parse('40')).toBe(2);
  });

  it('keeps the rest of the declaration as written', () => {
    const dependsOn = { key: 'x', shown: (v: string) => v === 'on' };
    const def = defineSetting({ ...base, key: 'a', default: 'on', allowed: onOff, help: 'More.', dependsOn });
    expect(def).toMatchObject({ key: 'a', section: 'look', label: 'Thing', hint: 'A thing.', help: 'More.', dependsOn });
  });
});

describe('isAllowed', () => {
  it('checks a value against the choices, the range and the text rule', () => {
    expect(isAllowed(onOff, 'on')).toBe(true);
    expect(isAllowed(onOff, 'x')).toBe(false);
    expect(isAllowed(onOff, 1)).toBe(false);
    const range = { kind: 'number', min: 1, max: 5, step: 1 } as const;
    expect(isAllowed(range, 5)).toBe(true);
    expect(isAllowed(range, 5.5)).toBe(false);
    expect(isAllowed(range, '3')).toBe(false);
    expect(isAllowed(range, Number.POSITIVE_INFINITY)).toBe(false);
    const text = { kind: 'text', valid: (v: string) => v.startsWith('a'), example: 'ab' } as const;
    expect(isAllowed(text, 'abc')).toBe(true);
    expect(isAllowed(text, 'bcd')).toBe(false);
    expect(isAllowed(text, 4)).toBe(false);
  });
});
