// The one list of every row the Settings screen has: its key, name, one-line hint, longer help, section and what it depends on. The screen
// draws exactly these rows, the search filters them by name, hint and help, and a row that depends on another is drawn only while the other
// says so. Nothing here knows an app: the sections, the groups and the rows are arguments, so the same functions serve any app's list.
import type { Dependency } from './define.js';

export interface SettingsSection<S extends string = string> {
  id: S;
  title: string;
  /** under the title, when the rows do not say it */
  hint?: string;
}

/** A page of Settings: the home lists the groups and each opens as a page of its own holding its sections. */
export interface SettingsGroup<S extends string = string, G extends string = string> {
  id: G;
  title: string;
  /** under the title on the home: what is in it */
  hint: string;
  sections: readonly S[];
}

export interface SettingsRow<S extends string = string> {
  /** a setting's key ('theme') or any other row's the app lists ('link.about'); distinct in the list */
  key: string;
  /** what the row is called: its control's name */
  label: string;
  /** one line under the control, searched with the name */
  hint: string;
  /** the longer explanation, behind the row's 'More help'; searched as plain words */
  help?: string;
  section: S;
  /** the row is a detail of another: drawn only while that one says so */
  dependsOn?: Dependency;
}

/** The values the rows' dependencies read, as text, by row key. A key with no value (not read yet) is a dependency not met. */
export type Values = Readonly<Record<string, string>>;

export interface SearchOptions<R extends SettingsRow = SettingsRow> {
  /** a row's help as the words the search compares (the default drops the Markdown marks: stars, hashes, backticks, bullets); pass the app's own when it has one */
  plainHelp?: (help: string) => string;
  /** searchSettings only: which rows may be found (e.g. only those with a link to open); every row by default */
  only?: (row: R) => boolean;
}

/** Text as the search compares it: no capitals, no accents. */
export const foldText = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** Markdown as plain words: its marks gone, a list read in order. */
const defaultPlainHelp = (help: string): string =>
  help
    .replace(/^\s{0,3}(?:#{1,6}|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_`#]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

/** Every row, section by section in the order of `sections` (within a section, in the order given). A row whose section is not listed is a mistake, and throws. */
export function rowsInOrder<S extends string, R extends SettingsRow<S>>(sections: readonly SettingsSection<S>[], rows: readonly R[]): R[] {
  const ids = new Set<string>(sections.map((s) => s.id));
  for (const row of rows) if (!ids.has(row.section)) throw new Error(`row ${row.key} is in section ${row.section}, which is not one of the sections`);
  return sections.flatMap((section) => rows.filter((r) => r.section === section.id));
}

/** Whether a row's folded name, hint or help holds the folded query `q`. */
function holds(row: SettingsRow, q: string, plainHelp: (help: string) => string): boolean {
  if (foldText(row.label).includes(q) || foldText(row.hint).includes(q)) return true;
  return row.help !== undefined && foldText(plainHelp(row.help)).includes(q);
}

/** Whether each row's dependency is met, given the values read (a row with no dependency always is; one under a hidden row is not). */
function reading<R extends SettingsRow>(rows: readonly R[], values: Values) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const on = (row: R): boolean => {
    if (!row.dependsOn) return true;
    const value = values[row.dependsOn.key];
    const parent = byKey.get(row.dependsOn.key);
    return value !== undefined && row.dependsOn.shown(value) && (!parent || on(parent));
  };
  /** the row itself when it is drawn, else the nearest row it depends on that is */
  const drawnFor = (row: R): R | undefined => {
    let at: R | undefined = row;
    while (at && !on(at)) at = at.dependsOn ? byKey.get(at.dependsOn.key) : undefined;
    return at;
  };
  return { byKey, on, drawnFor };
}

/** The rows to draw: those whose dependency is met and, when `query` is not empty, whose name, hint or help holds it (ignoring capitals and accents).
 *  A row that matches but is hidden by what it depends on is reached through the row that turns it on, which is shown in its place. */
export function visibleRows<R extends SettingsRow>(rows: readonly R[], values: Values, query: string, options: SearchOptions<R> = {}): R[] {
  const { on, drawnFor } = reading(rows, values);
  const q = foldText(query.trim());
  if (q === '') return rows.filter(on);
  const shown = new Set<string>();
  for (const row of rows) {
    if (!holds(row, q, options.plainHelp ?? defaultPlainHelp)) continue;
    const at = drawnFor(row);
    if (at) shown.add(at.key);
  }
  return rows.filter((r) => shown.has(r.key));
}

/** The setting to turn on first for the row `key` to be drawn, when it is a detail of one that is off: the nearest row it depends on that is drawn, whose
 *  value hides it. Undefined when the row is drawn as it is (or is no row of the list). */
export function neededFor<R extends SettingsRow>(rows: readonly R[], values: Values, key: string): R | undefined {
  const { byKey, on, drawnFor } = reading(rows, values);
  const row = byKey.get(key);
  if (!row || on(row)) return undefined;
  return drawnFor(row);
}

/** The rows to draw at a link to the row `key`: what visibleRows gives for `query`, and that row though the query or its dependency would hide it,
 *  with the setting to turn on first (neededFor) beside it. */
export function rowsAt<R extends SettingsRow>(rows: readonly R[], values: Values, query: string, key: string | null, options: SearchOptions<R> = {}): R[] {
  const drawn = visibleRows(rows, values, query, options);
  if (key === null || !rows.some((r) => r.key === key)) return drawn;
  const keep = new Set([...drawn.map((r) => r.key), key]);
  const needed = neededFor(rows, values, key);
  if (needed) keep.add(needed.key);
  return rows.filter((r) => keep.has(r.key));
}

/** The group a section is in. A section drawn on the home itself is in none (it throws); so does a section no group holds. */
export function groupOf<S extends string, G extends SettingsGroup<S>>(groups: readonly G[], section: S, homeSections: readonly S[] = []): G {
  if (homeSections.includes(section)) throw new Error(`section ${section} is on the home, in no group`);
  const group = groups.find((g) => g.sections.includes(section));
  if (!group) throw new Error(`section ${section} is in no group`);
  return group;
}

/** The groups the home lists: those with a row drawn, given the values read (a group whose rows all hide, as Developer does until it is found, is not listed). */
export function visibleGroups<S extends string, R extends SettingsRow<S>, G extends SettingsGroup<S>>(
  rows: readonly R[],
  groups: readonly G[],
  values: Values,
  homeSections: readonly S[] = [],
): G[] {
  const drawn = new Set(visibleRows(rows, values, '').filter((r) => !homeSections.includes(r.section)).map((r) => groupOf(groups, r.section, homeSections).id));
  return groups.filter((g) => drawn.has(g.id));
}

/** The rows whose name, hint or help holds `query`, ignoring capitals and accents, for a search that is one tap away from every screen. A detail that is
 *  hidden while its setting is off is found too. Nothing for an empty query. */
export function searchSettings<R extends SettingsRow>(rows: readonly R[], query: string, options: SearchOptions<R> = {}): R[] {
  const q = foldText(query.trim());
  if (q === '') return [];
  return rows.filter((r) => (options.only?.(r) ?? true) && holds(r, q, options.plainHelp ?? defaultPlainHelp));
}

/** What is wrong with a table of groups, one sentence each (an empty list when it is right): every section in exactly one group but the home's own, no
 *  section that does not exist, no group empty, no id or title used twice. A test of the app's own table calls this and expects `[]`. */
export function groupProblems<S extends string>(
  sections: readonly SettingsSection<S>[],
  groups: readonly SettingsGroup<S>[],
  homeSections: readonly S[] = [],
): string[] {
  const problems: string[] = [];
  const known = new Set<string>(sections.map((s) => s.id));
  for (const section of sections.filter((s) => !homeSections.includes(s.id))) {
    const holding = groups.filter((g) => g.sections.includes(section.id)).length;
    if (holding === 0) problems.push(`section ${section.id} is in no group`);
    else if (holding > 1) problems.push(`section ${section.id} is in ${holding} groups`);
  }
  for (const group of groups) {
    for (const id of group.sections) if (!known.has(id)) problems.push(`group ${group.id} names section ${id}, which does not exist`);
    for (const id of group.sections) if (homeSections.includes(id)) problems.push(`group ${group.id} names section ${id}, which is drawn on the home`);
    if (group.sections.length === 0) problems.push(`group ${group.title} has no sections`);
  }
  for (const [what, values] of [['id', groups.map((g) => g.id)], ['title', groups.map((g) => g.title)]] as const) {
    for (const value of new Set(values.filter((v, i) => values.indexOf(v) !== i))) problems.push(`group ${what} ${value} is used twice`);
  }
  return problems;
}
