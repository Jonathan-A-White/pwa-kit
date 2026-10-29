# @pwa-kit/settings

The settings of an installed web app: each declared once, listed once, searched from one box and hidden when they do not apply.
Lifted from Lampas's Settings. The kit knows **no app**: the sections, the groups, the settings and the storage are yours, passed in
as arguments, and a test of your own table can fail when you add a section to no group. React 18 or later is the one peer
dependency; it imports nothing else.

What it does:

1. **`defineSetting`** declares a setting once: its key, default, what it allows (a choice, a number in a range, or text a rule
   accepts), how a saved value is read back, and where it sits (section, name, hint, help, what it depends on). It throws when the
   app starts for a declaration that cannot work, such as a default outside what it allows.
2. **One list of rows** (`rowsInOrder`) is everything the screen draws. `visibleRows(rows, values, query)` gives the rows to draw: a row
   that **depends on** another (`dependsOn: { key, shown(value) }`) is hidden while that one says no, however deep the chain, and
   the search (name, hint and help, ignoring capitals and accents) shows the row that turns a hidden match on in its place.
   `neededFor` names the setting to turn on first; `rowsAt` keeps one linked row in view; `visibleGroups` leaves out a group with
   nothing to show; `groupProblems` checks your table of groups.
3. **A registry** (`createRegistry`) over a store on **storage you inject** reads and saves each setting, and checks a change asked for
   in words (by an assistant, say) against what each setting allows: `applyChanges`, `offeredChange`, `undoChange`, `currentSettings`.
4. **`SettingsHome`** is the home screen: a search box and a button for each group that has something to show; typing swaps the groups
   for the rows that match, each saying which group it is in. Tap targets are 44 px at least. Navigation is yours: it calls back.

<!-- toc -->

- [Install](#install)
- [Use](#use)
- [The pieces](#the-pieces)
  - [The search](#the-search)
  - [What the app owns](#what-the-app-owns)
  - [Style](#style)
- [Develop](#develop)

<!-- /toc -->

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

```tsx
import {
  SettingsHome, createRegistry, createSettingsStore, defineSetting, entryOf, rowsInOrder,
  type SettingsGroup, type SettingsRow, type SettingsSection,
} from 'pwa-kit/settings';
import 'pwa-kit/settings/styles.css'; // optional: the default look; or style the bk-settings__* classes yourself

// Your sections (in the order the screen draws them) and groups. The section ids are your own type.
type Section = 'look' | 'sync';
const SECTIONS: readonly SettingsSection<Section>[] = [{ id: 'look', title: 'Look' }, { id: 'sync', title: 'Sync' }];
const GROUPS: readonly SettingsGroup<Section>[] = [
  { id: 'display', title: 'Display', hint: 'Theme and text.', sections: ['look'] },
  { id: 'data', title: 'Your data', hint: 'Sync.', sections: ['sync'] },
];
// in a test, with groupProblems from 'pwa-kit/settings': expect(groupProblems(SECTIONS, GROUPS)).toEqual([]);

// Settings, declared once.
const onOff = { kind: 'choice', values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] } as const;
const theme = defineSetting<string, Section>({
  key: 'theme', default: 'light', section: 'look', label: 'Theme', hint: 'Light or dark.',
  allowed: { kind: 'choice', values: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] },
});
const sync = defineSetting<string, Section>({ key: 'sync', default: 'off', allowed: onOff, section: 'sync', label: 'Sync', hint: 'Keep notes on every device.' });
const often = defineSetting<string, Section>({
  key: 'often', default: 'on', allowed: onOff, section: 'sync', label: 'Often', hint: 'Sync every five minutes.',
  dependsOn: { key: 'sync', shown: (value) => value === 'on' }, // drawn only while Sync is on
});

// Storage is yours: every value is text. IndexedDB, localStorage, a Map in a test.
const store = createSettingsStore({
  read: (key) => localStorage.getItem(`settings:${key}`) ?? undefined,
  write: (key, value) => localStorage.setItem(`settings:${key}`, value),
});
const registry = createRegistry([theme, sync, often].map((def) => entryOf(def, store)));

// One list of rows: the settings, plus any row that is not one (a link to another screen).
const ROWS = rowsInOrder<Section, SettingsRow<Section>>(SECTIONS, registry.entries);

// The home. `values` holds the current value of every row some other row depends on (here: sync).
export function Home({ values, openGroup, openRow }: { values: Record<string, string>; openGroup: (id: string) => void; openRow: (row: SettingsRow<Section>) => void }) {
  return <SettingsHome rows={ROWS} groups={GROUPS} values={values} onOpenGroup={openGroup} onOpenRow={openRow} />;
}

// With Sync off, `visibleRows(ROWS, { sync: 'off' }, '')` has no 'often', and `neededFor(ROWS, { sync: 'off' }, 'often')` is the Sync row.
// await registry.applyChanges([{ key: 'theme', value: 'dark' }]) saves it, or refuses a value Theme does not allow.
```

`values` is what `readValues` would be in your app: read the settings some other row depends on (`await store.get(sync)`), as text.
A row whose value is not given is a dependency not met.

## The pieces

| Export | What it is |
| --- | --- |
| `defineSetting`, `isAllowed` | a setting declared once; whether a value is one a setting allows |
| `rowsInOrder`, `visibleRows`, `neededFor`, `rowsAt`, `visibleGroups`, `groupOf`, `searchSettings`, `groupProblems`, `foldText` | the one list of rows, searched and hidden by what does not apply (pure functions over arrays you pass) |
| `createSettingsStore`, `entryOf`, `createRegistry` | reading, saving and applying a change over injected storage |
| `SettingsHome`, `SettingsSearch`, `GroupButton`, `Found`, `TAP_TARGET` | the home screen and its pieces |

### The search

Typing in the box matches a row's **name, hint and help**, ignoring capitals and accents (`CAFÉ` finds `Café mode`). The help is
read as plain words: its Markdown marks (stars, hashes, backticks, bullets) are not searched. If your app has its own way of reading
help as words (to speak it, say), pass it: `searchOptions={{ plainHelp }}`.

### What the app owns

- Sections and groups. A section drawn on the home itself, above the groups (a dial, say), is a `homeSections` entry: it is in no group.
- The pages. A tap on a group calls `onOpenGroup(id)`; on a found row, `onOpenRow(row)`. Open your own page, scrolled to the row.
- The controls. The kit lists and finds rows; how a row is drawn is yours.
- Other rows. A link to another screen, a switch kept outside the registry, a request box: give it as a plain `SettingsRow`, with
  the sections' ids, next to the settings'. Hide it with `dependsOn` as any other.
- A setting kept somewhere other than the shared storage: write its entry by hand: `{ ...entryOf(def, store), read, write }`.

### Style

`styles.css` is the default look, themed by CSS custom properties (`--bk-settings-target`, `--bk-settings-accent`, ...; the list is at
the top of the file). Every colour and size has a default; the surface and text follow the page into dark and light. The search box,
a group button and a found row are `min-height: var(--bk-settings-target, 44px)`. Leave the file out and style the `bk-settings__*`
classes yourself.

## Develop

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

The tests use a neutral notes app (`tests/support/fixtures.ts`) and need no network.
