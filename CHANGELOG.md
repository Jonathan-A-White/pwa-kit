# Changelog: pwa-kit

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

Each library keeps its own changelog; this one records the repo's releases and points at them:

- [@pwa-kit/whats-new](packages/whats-new/CHANGELOG.md)
- [@pwa-kit/tips](packages/tips/CHANGELOG.md)
- [@pwa-kit/test-preset](packages/test-preset/CHANGELOG.md)
- [@pwa-kit/alive](packages/alive/CHANGELOG.md)
- [@pwa-kit/tap](packages/tap/CHANGELOG.md)
- [@pwa-kit/day](packages/day/CHANGELOG.md)
- [@pwa-kit/launch-gate](packages/launch-gate/CHANGELOG.md)
- [@pwa-kit/app-update](packages/app-update/CHANGELOG.md)
- [@pwa-kit/picture-viewer](packages/picture-viewer/CHANGELOG.md)
- [@pwa-kit/settings](packages/settings/CHANGELOG.md)

## 0.9.0 (2026-10-22, not yet tagged)

- New: `pwa-kit/settings` (with `pwa-kit/settings/styles.css`): `defineSetting`, a registry over injected storage that checks and
  applies a change, one searched list of rows that hides a setting whose dependency is unmet (`visibleRows`, `neededFor`,
  `rowsAt`) and a group with nothing to show (`visibleGroups`), and a `SettingsHome` of groups and a search box, carved from
  Lampas's Settings (mw-79en7t.6). The sections, groups, settings and storage are the app's, passed in as arguments. React is its
  only peer. See [packages/settings](packages/settings/README.md).
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0, day 0.1.0, launch-gate 0.1.0,
  app-update 0.2.0, picture-viewer 0.1.0, settings 0.1.0.

## 0.8.0 (2026-10-22, not yet tagged)

- New: `pwa-kit/picture-viewer`: `PictureViewer`, `usePictureViewer` and `savePicture`, Postern's full-screen picture viewer
  (pinch, drag, double tap, Close, Escape, Back, optional Save) as a shared package, drawn on the browser's top layer
  (`<dialog>` and `showModal()`) so no app screen covers it (mw-t49ebj.1). The viewer never touches history: an app wires Back
  with `usePictureViewer`, or with its own Back stack (Lampas's `useSheetBack`); see the package README. React and React DOM
  are its peers.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0, day 0.1.0, launch-gate 0.1.0,
  app-update 0.2.0, picture-viewer 0.1.0.

## 0.7.0 (2026-10-19, not yet tagged)

- New: `pwa-kit/app-update`'s `hasNewsSince` may return a promise; a rejection or no answer offers the banner (mw-ti1qik.6).
- Changed: a quiet take-over of a build with nothing new now reloads the page, at start-up or while hidden (at the next hide
  if it landed while the person was looking), and is asked for again at the next hide if it did not happen. Postern and
  Legend, which give no `hasNewsSince`, are unaffected.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0, day 0.1.0, launch-gate 0.1.0,
  app-update 0.2.0.

## 0.6.0 (2026-10-18, not yet tagged)

- New: `pwa-kit/app-update`: `startAppUpdates`, `applyUpdate`, `useUpdateState` and `getUpdateState`, the PWA update state
  machine lifted from Postern 0.8.26 (mw-ti1qik.1). It looks for a new build on start, on return to the foreground and every
  30 minutes, offers a waiting build, and after the tap reloads once when the new worker takes over, or anyway after 10 s.
  An optional quiet take-over (`version`, `hasNewsSince`) takes a build with nothing new over without offering it. React is
  its optional peer.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0, day 0.1.0, launch-gate 0.1.0,
  app-update 0.1.0.

## 0.5.0 (2026-10-16, not yet tagged)

- New: `pwa-kit/launch-gate`: `openWithin` and the React `LaunchGate`. The gate opens the app's store with a timeout, says
  what it waits on after 3 s, offers Try again after 10 s, and at 15 s or on a throw says it failed with Try again
  (mw-iioh3i.3). React is its optional peer.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0, day 0.1.0, launch-gate 0.1.0.

## 0.4.0 (2026-10-16, not yet tagged)

- New: `pwa-kit/day`: `localDay`, `dayStart`, `addDays` and `isDay`, the user's own calendar day as a `'YYYY-MM-DD'` key, never the
  UTC day (mw-iioh3i.2). It imports nothing.
- New: `pwa-kit/day/eslint`: an ESLint 9 flat-config plugin with the rule `no-utc-day` against
  `toISOString().split('T')[0]`, `.slice(0, 10)` and `new Date('YYYY-MM-DD')`, and a config object an app puts in its
  `eslint.config.js`. pwa-kit's own lint uses it. ESLint is its optional peer.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0, day 0.1.0.

## 0.3.0 (2026-10-16, not yet tagged)

- New: `pwa-kit/tap`: `createTapGuard`, `useTapGuard`, `useSettled` and the `tapSettings.ms` seam. A tap that opens, closes or
  moves the view swallows a second tap within 300 ms; a control just drawn ignores taps for 300 ms (mw-iioh3i.1). React
  is its optional peer.
- New: `pwa-kit/tap/testing`: `twoTaps` for jsdom and `twoTapsAt` for Playwright, a double tap 120 ms apart. It imports
  nothing.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0, tap 0.1.0.

## 0.2.0 (2026-10-16, not yet tagged)

- New: `pwa-kit/test-preset`: vitest and Playwright timeouts sized for a loaded host (`vitestTimeouts`, `playwrightTimeouts`,
  `ASYNC_WAIT_MS`, `HOOK_TIMEOUT_MS`), the `MW_TIMING` filter (`timingFilter`, `playwrightTimingFilter`) and
  `settleAfterTeardown`, lifted from lampas and postern (mw-eo6dj9.1). It imports nothing.
- New: `pwa-kit/alive`: `useAlive()`, a guard for a React `setState` that runs after an await (mw-eo6dj9.1). React is
  its optional peer.
- Package versions: whats-new 0.1.2, tips 0.2.0, test-preset 0.1.0, alive 0.1.0.

## 0.1.0 (2026-10-16, not yet tagged)

- New: the repo. `@pwa-kit/whats-new` and `@pwa-kit/tips` moved from bsv-kit at
  f668445cdf49b53c11cb932a4b8475c0154ec404, where they were @bsv-kit/whats-new 0.1.2 and
  @bsv-kit/tips 0.2.0, with bsv-kit's tooling (lint, typecheck, the personal and credits checks, the consumer smoke
  test, CI). The code is unchanged.
- Changed (breaking, for an app moving from bsv-kit): the entry points are `pwa-kit/whats-new`,
  `pwa-kit/whats-new/styles.css` and `pwa-kit/tips`. Migration: install pwa-kit by commit and change `bsv-kit/` to
  `pwa-kit/` in each of those imports; the `bk-` class names, the `--bk-*` properties and tips' default storage key
  `bsv-kit:tips:dismissed` are unchanged.
- Package versions: whats-new 0.1.2, tips 0.2.0.
