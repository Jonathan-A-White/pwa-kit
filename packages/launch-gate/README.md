# @pwa-kit/launch-gate

A launch gate: opens the app's store (a Dexie database, say) before the app draws, with a timeout, and tells the person what
is going on instead of leaving a blank screen. React 18 or later is an optional peer dependency (the core, `openWithin`,
needs none).

What the person sees while the open runs:

| Time | Phase | The screen says |
| --- | --- | --- |
| 0 s | `opening` | `Opening…` |
| 3 s | `slow` | `Still waiting for <waitingOn>…` (or `Still opening…`) |
| 10 s | `retryable` | the same word, and a **Try again** button |
| 15 s, or the open throws | `failed` | `Could not open.` (the error's message when it has one) and **Try again** |

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

`pwa-kit/launch-gate`: wrap the app in the gate, with the open as a function of a signal.

```tsx
import Dexie from 'dexie';
import { LaunchGate } from 'pwa-kit/launch-gate';

const db = new Dexie('notes');
db.version(1).stores({ notes: '++id, day' });

export function Root() {
  return (
    <LaunchGate open={() => db.open()} waitingOn="your notes">
      {(db) => <App db={db} />}
    </LaunchGate>
  );
}
```

`db.open()` resolves to the database, so the children get it. A failed open (Dexie's `OpenFailedError`, a blocked upgrade)
is shown as its message, with **Try again**. Press it and the gate starts a fresh attempt with a fresh signal; whatever the
old attempt settles to later is ignored.

**Do not put a full-table scan in Dexie's `on('ready')`.** Dexie waits for `ready` handlers before `open()` resolves, so a
scan of a large table there is exactly the wait this gate times out on, and Try again repeats it. Open the database, draw
the app, and do the scan after.

### `<LaunchGate>`

| Prop | What it is |
| --- | --- |
| `open` | `(signal: AbortSignal) => Promise<T>`: opens the store. The signal is aborted at the timeout, on Try again and on unmount; pass it on if the open can use it |
| `children` | `(value: T) => ReactNode`: the app, drawn once the open resolves |
| `waitingOn` | what the slow word names, e.g. `'your notes'` |
| `words` | `{ opening, slow, tryAgain, failed }`, each overriding the English default; `slow` may be a function of `waitingOn` |
| `timing` | `{ slowAfterMs, tryAgainAfterMs, timeoutMs }`, default 3000, 10000, 15000 |

It renders `<div class="bk-launch-gate">` holding `<p class="bk-launch-gate__word" role="status">` and, when Try again is
offered, `<button type="button" class="bk-launch-gate__button">`. There is no stylesheet; the app styles those classes.

### `openWithin(open, options)`

The core, with no React: `openWithin(signal => store.open(), { slowAfterMs, tryAgainAfterMs, timeoutMs, onPhase, signal })`
resolves to the value, or rejects with a `LaunchTimeout` (at `timeoutMs`, after aborting the attempt's signal) or the
open's own error. `onPhase` is called with `'opening'`, `'slow'`, `'retryable'` and `'failed'` as they are reached. Aborting
`options.signal` stops the wait. It uses `setTimeout` and `clearTimeout` only, and clears them when it settles, so a test on
fake timers drives it exactly.

## Develop

From the repo root: `npm test` (the tests run on fake timers). Imports only `react` and its own files.
