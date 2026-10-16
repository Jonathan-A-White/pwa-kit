# Changelog: @pwa-kit/test-preset

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-16)

- New: `vitestTimeouts` (testTimeout 40 s, hookTimeout 120 s, expect.poll 20 s), `ASYNC_WAIT_MS` (10 s, for testing-library),
  `HOOK_TIMEOUT_MS` (120 s) and `playwrightTimeouts` (test 60 s, expect 20 s): the numbers lampas and postern settled on
  for a loaded host, each marked PROVISIONAL in the source (mw-eo6dj9.1).
- New: `timingFilter` and `playwrightTimingFilter`: `MW_TIMING=skip` leaves the `MW_TIMING_TESTS` globs out of a run,
  `MW_TIMING=only` runs just them, any other value is read as unset with one warning.
- New: `settleAfterTeardown`, lifted from postern (mw-ev7oyy.21): settle a promise with `window` gone and get back what it raised.
