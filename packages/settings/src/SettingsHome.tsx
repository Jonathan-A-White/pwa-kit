// The Settings home: a search box pinned at the top and, under it, a button for each group that has something to show; typing in the box
// replaces the groups with the rows that match, each saying which group it is in. The app owns navigation: a tap on a group or on a found row
// calls back, and the app opens the page. Style it with the package's stylesheet (styles.css), or write the bk-settings__* classes yourself.
import { useState } from 'react';
import type { ReactElement } from 'react';
import { groupOf, visibleGroups, visibleRows, type SearchOptions, type SettingsGroup, type SettingsRow, type Values } from './rows.js';

/** The smallest height of the search box, a group button and a found row, in px (the stylesheet's default for --bk-settings-target). */
export const TAP_TARGET = 44;

/** The search field at the top: it filters the rows by name, hint and help as the person types. */
export function SettingsSearch({ query, onChange, label = 'Search settings' }: { query: string; onChange: (query: string) => void; label?: string }): ReactElement {
  return (
    <div className="bk-settings__searchbar">
      <input
        type="search"
        value={query}
        placeholder={label}
        aria-label={label}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        className="bk-settings__search"
      />
    </div>
  );
}

/** One group on the home: a button that opens its page. */
export function GroupButton<G extends string>({ id, title, hint, onOpen }: { id: G; title: string; hint: string; onOpen: (id: G) => void }): ReactElement {
  return (
    <li>
      <button type="button" data-group={id} onClick={() => onOpen(id)} className="bk-settings__group">
        <span className="bk-settings__group-text">
          <span className="bk-settings__group-title">{title}</span>
          <span className="bk-settings__group-hint">{hint}</span>
        </span>
        <span aria-hidden="true" className="bk-settings__chevron">
          ›
        </span>
      </button>
    </li>
  );
}

export interface FoundProps<S extends string, G extends string, R extends SettingsRow<S>> {
  rows: readonly R[];
  query: string;
  groups: readonly SettingsGroup<S, G>[];
  homeSections?: readonly S[];
  onOpen: (row: R) => void;
}

/** What the search found: each row with the group it is in; choosing one calls `onOpen`. */
export function Found<S extends string, G extends string, R extends SettingsRow<S>>({ rows, query, groups, homeSections = [], onOpen }: FoundProps<S, G, R>): ReactElement {
  if (rows.length === 0)
    return (
      <p role="status" className="bk-settings__empty">
        Nothing in Settings matches “{query.trim()}”.
      </p>
    );
  return (
    <ul aria-label="Matching settings" className="bk-settings__list">
      {rows.map((row) => (
        <li key={row.key}>
          <button type="button" data-found={row.key} onClick={() => onOpen(row)} className="bk-settings__found">
            <span className="bk-settings__found-label">{row.label}</span>
            <span className="bk-settings__found-hint">{row.hint}</span>
            <span className="bk-settings__found-where">{homeSections.includes(row.section) ? 'at the top of Settings' : `in ${groupOf(groups, row.section, homeSections).title}`}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface SettingsHomeProps<S extends string, G extends string, R extends SettingsRow<S>> {
  /** every row of the app's list (rowsInOrder), the search's and the groups' only source */
  rows: readonly R[];
  groups: readonly SettingsGroup<S, G>[];
  /** the current value of every row some other row depends on, as text */
  values: Values;
  /** sections drawn on the home itself, above the groups, in no group */
  homeSections?: readonly S[];
  onOpenGroup: (id: G) => void;
  /** a found row was chosen: open the page of its group at that row */
  onOpenRow: (row: R) => void;
  /** the search text, when the app keeps it (so Back can bring it back); the box keeps its own when this is not given */
  query?: string;
  onQueryChange?: (query: string) => void;
  searchOptions?: SearchOptions<R>;
}

export function SettingsHome<S extends string, G extends string, R extends SettingsRow<S>>({
  rows,
  groups,
  values,
  homeSections = [],
  onOpenGroup,
  onOpenRow,
  query: given,
  onQueryChange,
  searchOptions,
}: SettingsHomeProps<S, G, R>): ReactElement {
  const [own, setOwn] = useState('');
  const query = given ?? own;
  const change = (next: string): void => {
    if (given === undefined) setOwn(next);
    onQueryChange?.(next);
  };
  const searching = query.trim() !== '';
  return (
    <div className="bk-settings">
      <SettingsSearch query={query} onChange={change} />
      {searching ? (
        <Found rows={visibleRows(rows, values, query, searchOptions)} query={query} groups={groups} homeSections={homeSections} onOpen={onOpenRow} />
      ) : (
        <ul className="bk-settings__list">
          {visibleGroups(rows, groups, values, homeSections).map((g) => (
            <GroupButton key={g.id} id={g.id} title={g.title} hint={g.hint} onOpen={onOpenGroup} />
          ))}
        </ul>
      )}
    </div>
  );
}
