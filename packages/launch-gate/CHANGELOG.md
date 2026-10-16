# Changelog: @pwa-kit/launch-gate

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-16)

- New: `openWithin(open, options)`: opens with a timeout, phases `opening`, `slow` (3 s), `retryable` (10 s) and `failed`
  (15 s or a throw), the attempt's signal aborted at the timeout (mw-iioh3i.3).
- New: `<LaunchGate>`: the opening word, a slow word that names what it waits on, a Try again button from 10 s, and the
  failed word at 15 s or on a throw. Try again starts a fresh attempt and ignores the old one. Class names
  `bk-launch-gate`, `__word` and `__button`; no stylesheet.
