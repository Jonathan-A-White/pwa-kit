# Changelog: @pwa-kit/app-update

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-19)

- New: `hasNewsSince` may return a promise (mw-ti1qik.6). It is asked once per waiting build; a rejection, a throw or an
  answer that is not a boolean (`null`, `undefined`) offers the banner, never a quiet take-over on a judge that could not
  answer. A sync answer acts at once, as before.
- Changed: a quiet take-over now reloads the page. At start-up, or while the app is hidden, it reloads once when the new
  worker takes control; one that landed while the person was looking reloads at the next hide; if the person came back before
  it took control and nothing took over, nothing reloads. This was "nothing reloads, the next launch runs it" in 0.1.0, which
  left the page running the old build under the new worker. Moving from 0.1.0: nothing to change for an app that does not
  give `hasNewsSince`.
- Changed: a build still waiting after a hide that did not take it over (the worker was held) is asked again at the next hide;
  0.1.0 asked once.
- Kept: the wake-up reload of an overdue tap and the 10 s patience, and the banner path when `hasNewsSince` is not given.
- Tests: Lampas's six quiet scenarios (tests/unit/app-update-quiet.test.ts) ported as `tests/quiet.test.ts`. Two assertions
  in `tests/appUpdate.test.ts` that held the 0.1.0 behaviour (no reload; asked once) now hold the new one.

## 0.1.0 (2026-10-18)

- New: `startAppUpdates(deps, options?)`, `applyUpdate()`, `useUpdateState()` and `getUpdateState()`, lifted from Postern's
  `appUpdate.ts` at 0.8.26 (mw-ti1qik.1). A waiting build is offered; the tap posts `SKIP_WAITING` and the page reloads once
  on the controller change, or after `TAKE_OVER_PATIENCE_MS` (10 s) if none comes, or on return to the foreground when the
  timer slept past it. Checks for a new build on start, on return to the foreground and every `UPDATE_CHECK_EVERY_MS` (30 min).
- New: the optional quiet take-over, `options.version` and `options.hasNewsSince`: a waiting build for which it says there is
  nothing new is never offered; it takes over at start-up or when the app is hidden, and nothing reloads. Without
  `hasNewsSince` it is off, and every waiting build is offered.
- New: the exported types `WorkerLike`, `UpdateContainer`, `UpdateRegistration`, `UpdateState`, `AppUpdates` and `AppUpdateOptions`.
