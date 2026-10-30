// link(key): the in-app route to a setting's row, and the key an address asks for.
import { describe, expect, it } from 'vitest';
import { link, settingKeyOf } from '../src/index.js';

describe('link', () => {
  it('yields the settings route with the row anchor', () => {
    expect(link('ynab')).toBe('#/settings?setting=ynab');
  });

  it('escapes a key so the address stays one address', () => {
    expect(link('ynab.token')).toBe('#/settings?setting=ynab.token');
    expect(link('a b&c')).toBe('#/settings?setting=a%20b%26c');
  });

  it('opens a settings screen the app mounts elsewhere', () => {
    expect(link('ynab', '#/prefs')).toBe('#/prefs?setting=ynab');
  });

  it('throws for an empty key', () => {
    expect(() => link('  ')).toThrow(/key/);
  });
});

describe('settingKeyOf', () => {
  it('reads the key back from a link', () => {
    expect(settingKeyOf(link('ynab'))).toBe('ynab');
    expect(settingKeyOf(link('a b&c'))).toBe('a b&c');
    expect(settingKeyOf(link('ynab', '#/prefs'), '#/prefs')).toBe('ynab');
  });

  it('is null for an address that is not the settings route or names no setting', () => {
    expect(settingKeyOf('#/settings')).toBeNull();
    expect(settingKeyOf('#/settings?group=reading')).toBeNull();
    expect(settingKeyOf('#/other?setting=ynab')).toBeNull();
    expect(settingKeyOf('#/settings-more?setting=ynab')).toBeNull();
    expect(settingKeyOf('#/settings?setting=')).toBeNull();
  });
});
