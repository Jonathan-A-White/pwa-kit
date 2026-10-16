# Changelog: @pwa-kit/whats-new

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## Moved to pwa-kit (2026-10-16)

- Changed (breaking): moved from bsv-kit at f668445cdf49b53c11cb932a4b8475c0154ec404, where this was @bsv-kit/whats-new 0.1.2. The package is now
  `@pwa-kit/whats-new` and its entry points are `pwa-kit/whats-new` and `pwa-kit/whats-new/styles.css`; the code is unchanged. Migration: install
  `github:Jonathan-A-White/pwa-kit#<full commit SHA>` and change `bsv-kit/whats-new` to `pwa-kit/whats-new` in each import.
  The `bk-whats-new__*` class names and `--bk-whats-new-*` properties keep their names.
- The entries below were written in [bsv-kit](https://github.com/Jonathan-A-White/bsv-kit), whose history before that
  commit is this package's past.

## 0.1.2 (2026-10-10)

- Fixed: the link from the version to `CHANGELOG.md` no longer lands at the top of the file when the running version wrote
  no entry (mw-s061bg.13). `versionLink` takes the optional `listed` (the versions the changelog lists) and links to the
  newest listed version at or below the running one; new `linkedVersion` names that version for the link's words. Without
  `listed` it behaves as before.

## 0.1.1 (2026-10-10)

- Fixed: Check for updates no longer says "Up to date" when nothing was checked (mw-s061bg.12). Offline
  (`navigator.onLine` false), or when the worker's script cannot be fetched from the server, it says "Couldn't check"
  and the button tries again; with no service worker to ask it says "Updates are not checked here" (new label
  `unavailable`). New optional `fetch` prop and `UpdateRegistration.active`. "Up to date" now needs the server to have answered.

## 0.1.0 (2026-10-09)

- New: `useChangelog`, `summarise`, `UpdateSummary`, `WhatsNewSheet`, `WhatsNewList`, `CheckForUpdates` and
  `versionLink`: the Update ready banner's summary, a one-time What's new sheet after an update (never on a first
  install), the versions list for About, a Check for updates button, and the link from the version to
  `CHANGELOG.md` on GitHub (mw-s061bg.2). Themed by `--bk-whats-new-*` and `bk-whats-new__*` classes
  (`bsv-kit/whats-new/styles.css`).
