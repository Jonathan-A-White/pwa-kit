# Changelog: @pwa-kit/tap

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-16)

- New: `createTapGuard()` and `useTapGuard()`: a guard shared by the view-changing controls of a screen, so the second
  tap of a double tap (a second tap within 300 ms of an accepted one) is swallowed wherever it lands (mw-iioh3i.1).
- New: `useSettled(key)`: `settled()` is false for 300 ms after a control is drawn or `key` changes, so a tap in that
  moment does nothing; lifted from lampas.
- New: `tapSettings.ms`, the seam a test or an e2e run sets (0 = no settle); default 300.
- New: `pwa-kit/tap/testing`: `twoTaps` (jsdom) and `twoTapsAt` (Playwright, typed structurally) to tap twice, 120 ms apart.
