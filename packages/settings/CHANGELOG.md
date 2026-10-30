# Changelog: @pwa-kit/settings

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-30)

- New: a connection kind, lifted from Lampas's Logos switch (mw-mr4xgrw.4). `createConnections(store)` registers a connection (`register({ key,
  name, section, hint, fields })`): one switch, saved under the connection's key as `'on'` or `'off'` and **Off for a stranger**, and fields that
  depend on it, saved as `<key>.<field>`. `connections.entries` goes to `createRegistry` with the app's own entries; `useConnectionOn(key)` is
  live and is false until the saved switch is read, so a screen that draws only while it is true draws **nothing of a connection while it is
  Off**; `isOn(key)` is the same answer without React. Additive.
- New: `link(key)` is the in-app route to a setting's row (`#/settings?setting=ynab`; `link(key, route)` for a Settings screen mounted
  elsewhere) and `settingKeyOf(address)` reads the key back. Lampas's `settingLink` and `settingKeyOf` without its registry check and its router.

## 0.1.0 (2026-10-22)

- New: `defineSetting`, the registry, the row list and `SettingsHome`, carved from Lampas's `src/settings` (mw-79en7t.6):
  `define.ts`, `rows.ts`, `registry.ts`, `store.ts` and `SettingsHome.tsx`. The settings you declare are listed once, searched
  by name, hint and help (ignoring capitals and accents), hidden while the setting they depend on says no, and the home leaves out
  a group with nothing to show.
- Changed from Lampas: the sections, the groups, the row list and the storage are arguments, not module-level tables, so any app
  brings its own; the section and group ids are the app's own types. `visibleRows(rows, values, query)` takes the rows first (it
  defaulted to Lampas's `ROWS` last). The store keeps its own listeners instead of Lampas's event bus, over a storage
  `{ read, write }` the app injects (Lampas's Dexie table); `useSetting`, the `store` override on a definition, the study
  resources, the links, Developer mode and the Greek dial stay in Lampas. `SettingsHome` takes `onOpenGroup` and `onOpenRow`
  instead of changing the address, and draws with `bk-settings__*` classes and a stylesheet instead of Tailwind.
- New: `defineSetting` rejects a default outside what the setting allows, an empty key, name or hint, and a choice with no values.
  `groupProblems` checks a table of groups (a section in no group or two, an empty or repeated group); Lampas's `settings-groups`
  test did this against its own table. `rowsInOrder` throws for a row in a section that is not listed.
- Tests: Lampas's `settings-rows`, `settings-groups` and `settings-registry` cases (the row list, show-when-on, the search, the
  groups, `applyChanges`) with a neutral notes app; new for `SettingsHome` (jsdom) and the 44 px tap targets.
