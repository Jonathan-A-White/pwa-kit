import { describe, expect, it } from 'vitest';
import {
  foldText,
  groupOf,
  groupProblems,
  neededFor,
  rowsAt,
  rowsInOrder,
  searchSettings,
  visibleGroups,
  visibleRows,
  type Values,
} from '../src/index.js';
import { DEFS, EXTRA_ROWS, GROUPS, HOME_SECTIONS, SECTIONS, settingRow } from './support/fixtures.js';

const ROWS = rowsInOrder(SECTIONS, [...EXTRA_ROWS, ...DEFS.map(settingRow)]);
const keys = (rows: readonly { key: string }[]) => rows.map((r) => r.key);
const ALL_ON: Values = { sync: 'on', syncEvery: '15', developerMode: 'on' };

describe('rowsInOrder', () => {
  it('lists the rows section by section in the sections\' order, and keeps a section\'s rows in the order given', () => {
    expect(keys(ROWS)).toEqual(['link.tour', 'theme', 'cafe', 'textSize', 'sync', 'syncEvery', 'syncOnWifi', 'developer']);
  });

  it('throws for a row whose section is not one of the sections', () => {
    expect(() => rowsInOrder(SECTIONS, [{ key: 'x', label: 'X', hint: 'x', section: 'nowhere' as never }])).toThrow(/nowhere/);
  });
});

describe('visibleRows', () => {
  it('hides a setting whose dependency is unmet, and what hangs from it', () => {
    const shown = keys(visibleRows(ROWS, { sync: 'off', developerMode: 'hidden' }, ''));
    expect(shown).not.toContain('syncEvery');
    expect(shown).not.toContain('syncOnWifi');
    expect(shown).not.toContain('developer');
    expect(shown).toContain('sync');
  });

  it('hides a row whose own dependency is met but whose parent is hidden', () => {
    // syncOnWifi is shown whenever syncEvery has any value, but syncEvery itself is hidden while sync is off
    expect(keys(visibleRows(ROWS, { sync: 'off', syncEvery: '15', developerMode: 'on' }, ''))).not.toContain('syncOnWifi');
  });

  it('hides a row whose value has not been read (a missing value is not a met dependency)', () => {
    expect(keys(visibleRows(ROWS, {}, ''))).not.toContain('syncEvery');
  });

  it('shows every row when every dependency is met, in list order', () => {
    expect(keys(visibleRows(ROWS, ALL_ON, ''))).toEqual(keys(ROWS));
    expect(keys(visibleRows(ROWS, ALL_ON, '   '))).toEqual(keys(ROWS));
  });

  it('searches the name and the hint, folding accents and capitals', () => {
    expect(keys(visibleRows(ROWS, ALL_ON, 'THEME'))).toEqual(['theme']);
    expect(keys(visibleRows(ROWS, ALL_ON, 'cafe'))).toEqual(['cafe']);
    expect(keys(visibleRows(ROWS, ALL_ON, 'CAFÉ'))).toEqual(['cafe']);
    expect(keys(visibleRows(ROWS, ALL_ON, 'café'))).toEqual(['cafe']);
    expect(keys(visibleRows(ROWS, ALL_ON, 'warmer COLOURS'))).toEqual(['cafe']);
    expect(visibleRows(ROWS, ALL_ON, 'zzzz')).toEqual([]);
  });

  it('searches the longer help as plain words, not its Markdown marks', () => {
    expect(keys(visibleRows(ROWS, ALL_ON, 'sepia'))).toEqual(['cafe']);
    expect(keys(visibleRows(ROWS, ALL_ON, '**sepia**'))).toEqual([]);
    expect(keys(visibleRows(ROWS, ALL_ON, 'easier on the eyes'))).toEqual(['cafe']);
  });

  it('takes the app\'s own way of reading help as words', () => {
    const plainHelp = () => 'zebra';
    expect(keys(visibleRows(ROWS, ALL_ON, 'zebra', { plainHelp }))).toEqual(['cafe']);
    expect(keys(visibleRows(ROWS, ALL_ON, 'sepia', { plainHelp }))).toEqual([]);
  });

  it('shows, for a match that is hidden, the row that turns it on', () => {
    expect(keys(visibleRows(ROWS, { sync: 'off' }, 'minutes'))).toEqual(['sync']);
    expect(keys(visibleRows(ROWS, { sync: 'off' }, 'mobile data'))).toEqual(['sync']);
  });

  it('shows the match itself, not its parent, when it is visible', () => {
    expect(keys(visibleRows(ROWS, ALL_ON, 'minutes'))).toEqual(['syncEvery']);
  });
});

describe('neededFor', () => {
  it('names the setting to turn on first for a hidden detail', () => {
    expect(neededFor(ROWS, { sync: 'off' }, 'syncEvery')?.key).toBe('sync');
  });

  it('names the nearest drawn ancestor for a detail of a detail', () => {
    expect(neededFor(ROWS, { sync: 'off', syncEvery: '15' }, 'syncOnWifi')?.key).toBe('sync');
  });

  it('names nothing for a row that is drawn, and for a key that is no row', () => {
    expect(neededFor(ROWS, ALL_ON, 'syncEvery')).toBeUndefined();
    expect(neededFor(ROWS, ALL_ON, 'theme')).toBeUndefined();
    expect(neededFor(ROWS, ALL_ON, 'nothing')).toBeUndefined();
  });
});

describe('rowsAt', () => {
  it('is visibleRows with no link', () => {
    expect(rowsAt(ROWS, ALL_ON, 'theme', null)).toEqual(visibleRows(ROWS, ALL_ON, 'theme'));
  });

  it('keeps the linked row though the search or its dependency would hide it, with the row to turn on first', () => {
    const shown = keys(rowsAt(ROWS, { sync: 'off' }, 'theme', 'syncEvery'));
    expect(shown).toEqual(['theme', 'sync', 'syncEvery']);
  });

  it('ignores a link to a key that is no row', () => {
    expect(rowsAt(ROWS, { sync: 'off' }, '', 'nothing')).toEqual(visibleRows(ROWS, { sync: 'off' }, ''));
  });
});

describe('groups', () => {
  const home = HOME_SECTIONS;
  it('hides a group with no visible row', () => {
    const hidden: Values = { sync: 'off', developerMode: 'hidden' };
    expect(visibleGroups(ROWS, GROUPS, hidden, home).map((g) => g.id)).toEqual(['display', 'data']);
    expect(visibleGroups(ROWS, GROUPS, { developerMode: 'off' }, home).map((g) => g.id)).toEqual(['display', 'data', 'developer']);
  });

  it('does not list a group for a row drawn on the home itself', () => {
    const onlyWelcome = ROWS.filter((r) => r.section === 'welcome');
    expect(visibleGroups(onlyWelcome, GROUPS, {}, home)).toEqual([]);
  });

  it('finds the group of a section; a home section is in none, and an unknown section throws', () => {
    expect(groupOf(GROUPS, 'text', home).id).toBe('display');
    expect(() => groupOf(GROUPS, 'welcome', home)).toThrow(/on the home/);
    expect(() => groupOf(GROUPS, 'nowhere' as never, home)).toThrow(/no group/);
  });

  it('puts every section in exactly one group but the home\'s own, with no empty group', () => {
    expect(groupProblems(SECTIONS, GROUPS, home)).toEqual([]);
  });

  it('reports a section in no group, in two, one that does not exist, and an empty or repeated group', () => {
    const bad = [
      { id: 'display', title: 'Display', hint: 'x', sections: ['look', 'text', 'sync'] },
      { id: 'data', title: 'Display', hint: 'x', sections: ['sync', 'ghost'] },
      { id: 'data', title: 'Empty', hint: 'x', sections: [] },
    ] as never;
    const problems = groupProblems(SECTIONS, bad, home).join('\n');
    expect(problems).toMatch(/advanced is in no group/);
    expect(problems).toMatch(/sync is in 2 groups/);
    expect(problems).toMatch(/ghost/);
    expect(problems).toMatch(/Empty has no sections/);
    expect(problems).toMatch(/group id data is used twice/);
    expect(problems).toMatch(/title Display is used twice/);
  });
});

describe('searchSettings', () => {
  it('finds rows by name, hint or help, folded, and nothing for an empty query', () => {
    expect(keys(searchSettings(ROWS, 'cafe'))).toEqual(['cafe']);
    expect(keys(searchSettings(ROWS, 'SEPIA'))).toEqual(['cafe']);
    expect(searchSettings(ROWS, '  ')).toEqual([]);
  });

  it('finds a detail that is hidden while its setting is off, and takes a filter for rows that have no link', () => {
    expect(keys(searchSettings(ROWS, 'minutes'))).toEqual(['syncEvery']);
    expect(keys(searchSettings(ROWS, 'tour'))).toEqual(['link.tour']);
    expect(searchSettings(ROWS, 'tour', { only: (row) => !row.key.startsWith('link.') })).toEqual([]);
  });
});

describe('foldText', () => {
  it('drops capitals and accents, for any script that has them', () => {
    expect(foldText('Café')).toBe('cafe');
    expect(foldText('Ἀγάπη')).toBe(foldText('αγαπη'));
  });
});
