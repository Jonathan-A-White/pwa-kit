# Changelog: @pwa-kit/day

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-16)

- New: `pwa-kit/day`: `localDay()`, `dayStart()`, `addDays()` and `isDay()`, the user's own calendar day as a `'YYYY-MM-DD'` key
  from the local calendar fields, never the UTC day; a bad day string throws a `DayError` (mw-iioh3i.2). Lifted from
  lampas's `dayOf` (mw-yrmkdf.9). It imports nothing.
- New: `pwa-kit/day/eslint`: an ESLint 9 flat-config plugin `pwa-kit-day` with the rule `no-utc-day`, against
  `toISOString().split('T')`, `.slice(0, 10)`, `.substring(0, 10)`, `.substr(0, 10)` and `new Date('YYYY-MM-DD')`, and a
  config object that turns it on. ESLint is its optional peer.
