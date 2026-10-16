# Changelog: pwa-kit

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

Each library keeps its own changelog; this one records the repo's releases and points at them:

- [@pwa-kit/whats-new](packages/whats-new/CHANGELOG.md)
- [@pwa-kit/tips](packages/tips/CHANGELOG.md)

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
