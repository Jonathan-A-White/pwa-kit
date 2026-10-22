// @vitest-environment jsdom
// <SettingsHome>: a search box and the groups, with the search hiding what does not apply. Neutral fixtures (tests/support/fixtures.ts).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsHome, TAP_TARGET, rowsInOrder, type Values } from '../src/index.js';
import { DEFS, EXTRA_ROWS, GROUPS, HOME_SECTIONS, SECTIONS, settingRow } from './support/fixtures.js';

afterEach(cleanup);

const ROWS = rowsInOrder(SECTIONS, [...EXTRA_ROWS, ...DEFS.map(settingRow)]);
const HIDDEN: Values = { sync: 'off', developerMode: 'hidden' };
const ALL_ON: Values = { sync: 'on', syncEvery: '15', developerMode: 'on' };

function home(values: Values = HIDDEN, props: Partial<Parameters<typeof SettingsHome>[0]> = {}) {
  const onOpenGroup = vi.fn();
  const onOpenRow = vi.fn();
  render(<SettingsHome rows={ROWS} groups={GROUPS} values={values} homeSections={HOME_SECTIONS} onOpenGroup={onOpenGroup} onOpenRow={onOpenRow} {...props} />);
  return { onOpenGroup, onOpenRow };
}
const search = () => screen.getByRole('searchbox', { name: 'Search settings' }) as HTMLInputElement;
const type = (text: string) => fireEvent.change(search(), { target: { value: text } });
const groupButtons = () => [...document.querySelectorAll('[data-group]')].map((el) => el.getAttribute('data-group'));

describe('<SettingsHome> the groups', () => {
  it('shows a search box and a button for each group, with its hint', () => {
    home(ALL_ON);
    expect(search().value).toBe('');
    expect(groupButtons()).toEqual(['display', 'data', 'developer']);
    const display = document.querySelector('[data-group="display"]') as HTMLElement;
    expect(display.textContent).toContain('Display');
    expect(display.textContent).toContain('Theme and text size.');
  });

  it('leaves out a group with no row to show', () => {
    home(HIDDEN);
    expect(groupButtons()).toEqual(['display', 'data']);
  });

  it('opens a group when its button is tapped', () => {
    const { onOpenGroup } = home(ALL_ON);
    fireEvent.click(screen.getByRole('button', { name: /Your data/ }));
    expect(onOpenGroup).toHaveBeenCalledTimes(1);
    expect(onOpenGroup).toHaveBeenCalledWith('data');
  });
});

describe('<SettingsHome> the search', () => {
  it('replaces the groups with the rows that match, each with the group it is in', () => {
    home(ALL_ON);
    type('theme');
    expect(groupButtons()).toEqual([]);
    const found = within(screen.getByRole('list', { name: 'Matching settings' }));
    expect(found.getAllByRole('listitem')).toHaveLength(1);
    const row = document.querySelector('[data-found="theme"]') as HTMLElement;
    expect(row.textContent).toContain('Theme');
    expect(row.textContent).toContain('Light or dark.');
    expect(row.textContent).toContain('in Display');
  });

  it('folds accents and capitals', () => {
    home(ALL_ON);
    type('CAFE');
    expect(document.querySelector('[data-found="cafe"]')).not.toBeNull();
    type('café');
    expect(document.querySelector('[data-found="cafe"]')).not.toBeNull();
  });

  it('hides a setting that does not apply, and shows the one that turns it on in its place', () => {
    home(HIDDEN);
    type('minutes between');
    expect(document.querySelector('[data-found="syncEvery"]')).toBeNull();
    expect(document.querySelector('[data-found="sync"]')).not.toBeNull();
    type('');
    expect(groupButtons()).toEqual(['display', 'data']);
  });

  it('says so when nothing matches', () => {
    home(ALL_ON);
    type('  zzzz ');
    expect(screen.getByRole('status').textContent).toBe('Nothing in Settings matches “zzzz”.');
  });

  it('opens a found row through the app', () => {
    const { onOpenRow } = home(ALL_ON);
    type('text size');
    fireEvent.click(document.querySelector('[data-found="textSize"]') as HTMLElement);
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow.mock.calls[0][0].key).toBe('textSize');
  });

  it('says a row of the home itself is at the top of Settings', () => {
    home(ALL_ON);
    type('tour');
    expect((document.querySelector('[data-found="link.tour"]') as HTMLElement).textContent).toContain('at the top of Settings');
  });

  it('can be driven from outside: a given query is shown, and typing is reported', () => {
    const onQueryChange = vi.fn();
    home(ALL_ON, { query: 'theme', onQueryChange });
    expect(search().value).toBe('theme');
    expect(document.querySelector('[data-found="theme"]')).not.toBeNull();
    type('sync');
    expect(onQueryChange).toHaveBeenCalledWith('sync');
    // still showing what it was given
    expect(search().value).toBe('theme');
  });

  it('turns off the phone\'s help with typing in a search box', () => {
    home(ALL_ON);
    expect(search().getAttribute('autocapitalize')).toBe('none');
    expect(search().getAttribute('autocorrect')).toBe('off');
    expect(search().getAttribute('spellcheck')).toBe('false');
    expect(search().getAttribute('enterkeyhint')).toBe('search');
  });
});

describe('<SettingsHome> tap targets (at least 44 px)', () => {
  const css = readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'src/styles.css'), 'utf-8');
  /** the declarations of the rules whose selector list holds `selector` */
  const ruleOf = (selector: string): string => {
    const rules = [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const found = rules.filter((m) => m[1].split(',').some((s) => s.trim() === selector));
    if (found.length === 0) throw new Error(`no rule for ${selector} in styles.css`);
    return found.map((m) => m[2]).join(';');
  };
  const minHeight = (selector: string): number => {
    const decl = ruleOf(selector).match(/min-height:\s*var\(--bk-settings-target,\s*(\d+)px\)/);
    if (!decl) throw new Error(`${selector} has no min-height from --bk-settings-target`);
    return Number(decl[1]);
  };

  it('is 44 px at least, by default, for the search box, a group button and a found row', () => {
    expect(TAP_TARGET).toBeGreaterThanOrEqual(44);
    for (const selector of ['.bk-settings__search', '.bk-settings__group', '.bk-settings__found']) {
      expect(minHeight(selector), selector).toBeGreaterThanOrEqual(44);
    }
    expect(css).toMatch(new RegExp(`--bk-settings-target: ${TAP_TARGET}px`));
  });

  it('puts those classes on the box, each group button and each found row', () => {
    home(ALL_ON);
    expect(search().classList.contains('bk-settings__search')).toBe(true);
    for (const button of document.querySelectorAll('[data-group]')) expect(button.classList.contains('bk-settings__group')).toBe(true);
    type('s');
    const rows = document.querySelectorAll('[data-found]');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.classList.contains('bk-settings__found')).toBe(true);
  });
});
