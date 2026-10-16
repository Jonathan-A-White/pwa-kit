# Changelog: @pwa-kit/tips

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## Moved to pwa-kit (2026-10-16)

- Changed (breaking): moved from bsv-kit at f668445cdf49b53c11cb932a4b8475c0154ec404, where this was @bsv-kit/tips 0.2.0. The package is now
  `@pwa-kit/tips` and its entry points are `pwa-kit/tips`; the code is unchanged. Migration: install
  `github:Jonathan-A-White/pwa-kit#<full commit SHA>` and change `bsv-kit/tips` to `pwa-kit/tips` in each import.
  The default storage key stays `bsv-kit:tips:dismissed`, so tips already dismissed stay dismissed.
- The entries below were written in [bsv-kit](https://github.com/Jonathan-A-White/bsv-kit), whose history before that
  commit is this package's past.

## 0.2.0 (2026-10-16)

The first release: the package was added on 2026-10-09 at version 0.2.0 (the number the repo shared then), and the tag
v0.2.0 is made on 2026-10-16.

- New: `createTips` with `nextTip(event)`, `dismiss(id)`, `isDismissed`, `reset` and `resetAll`: a list of one-time tips, the
  first not yet dismissed shown, dismissed for good through a storage the app injects (sync or async). No DOM; imports
  nothing from bsv or grist (mw-5r3p30.81).
