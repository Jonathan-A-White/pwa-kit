# Changelog: @pwa-kit/push

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-30)

- New: `createPush` with `subscribe()`, `unsubscribe()` and `status()`: Notify me on a phone. The permission is asked in plain words
  (`DEFAULT_WORDS`, every one replaceable), the browser's push manager subscribes with the backend's VAPID public key, and the
  subscription is posted to the backend once through a signer the app injects (bsv-kit's `Door` fits as it is). A denied permission or
  a phone that cannot do push is a status (`denied`, `unsupported`) holding the one plain line to show, not an error. Lifted from
  Postern's `src/services/push.ts` (mw-mr4xgrw.7). The backend, the key and the service worker registration are the app's, passed in.
  No dependencies.
- Changed from Postern: the removal is posted too (`POST /push/unsubscribe`, `paths.unsubscribe` to rename it or `null` for a backend
  with none), after the browser's subscription is cancelled; a backend that refuses the removal does not undo the cancel.
