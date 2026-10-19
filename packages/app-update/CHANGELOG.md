# Changelog: @pwa-kit/app-update

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-18)

- New: `startAppUpdates(deps, options?)`, `applyUpdate()`, `useUpdateState()` and `getUpdateState()`, lifted from Postern's
  `appUpdate.ts` at 0.8.26 (mw-ti1qik.1). A waiting build is offered; the tap posts `SKIP_WAITING` and the page reloads once
  on the controller change, or after `TAKE_OVER_PATIENCE_MS` (10 s) if none comes, or on return to the foreground when the
  timer slept past it. Checks for a new build on start, on return to the foreground and every `UPDATE_CHECK_EVERY_MS` (30 min).
- New: the optional quiet take-over, `options.version` and `options.hasNewsSince`: a waiting build for which it says there is
  nothing new is never offered; it takes over at start-up or when the app is hidden, and nothing reloads. Without
  `hasNewsSince` it is off, and every waiting build is offered.
- New: the exported types `WorkerLike`, `UpdateContainer`, `UpdateRegistration`, `UpdateState`, `AppUpdates` and `AppUpdateOptions`.
