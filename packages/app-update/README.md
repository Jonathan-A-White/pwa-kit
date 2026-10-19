# @pwa-kit/app-update

The update state machine of an installed web app (a PWA with a service worker): it finds a new build, offers it, and on the
person's tap takes it over and reloads. The banner itself stays in the app; this is its state. React 18 or later is an
optional peer dependency (`useUpdateState` needs it).

What it does:

1. Asks the browser whether there is a new build on start, on return to the foreground and every 30 minutes
   (`UPDATE_CHECK_EVERY_MS`), so a phone that keeps the app open for days still finds out. A failed check (offline) is
   ignored; the next one tries again.
2. While a build waits behind the one in control, the state is `'ready'`. The first worker ever has nothing to wait behind and
   is never offered.
3. `applyUpdate()` (the tap) posts `{ type: 'SKIP_WAITING' }` to the waiting worker and the state is `'updating'`. The page
   reloads **once**, when the controller changes: a controller change nobody asked for (a first install claiming the page,
   another tab's update) never reloads this tab.
4. If the new build has not taken over within `TAKE_OVER_PATIENCE_MS` (10 s), the page reloads anyway, so an update never hangs
   on Updating…. A backgrounded tab's timer can sleep past its time: on return to the foreground an overdue update reloads
   at once. Whichever comes first reloads; the others do nothing.

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

```tsx
import { applyUpdate, startAppUpdates, useUpdateState } from 'pwa-kit/app-update';

const registration = await navigator.serviceWorker.register('/sw.js');
startAppUpdates({ container: navigator.serviceWorker, registration, reload: () => location.reload() });

export function UpdateBanner() {
  const update = useUpdateState(); // 'none' | 'ready' | 'updating'
  if (update === 'none') return null;
  return (
    <button onClick={applyUpdate} disabled={update === 'updating'}>
      {update === 'updating' ? 'Updating…' : 'Update ready'}
    </button>
  );
}
```

The service worker handles the message, and claims the windows when it activates:

```ts
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
```

`startAppUpdates` takes `container` (`navigator.serviceWorker`), `registration` and `reload` as arguments, so a test passes
fakes (see `tests/appUpdate.test.ts`). It returns `{ apply, checkNow, stop }`; starting again stops the first. `stop` removes
its listeners and timers and puts the state back to `'none'`.

### The quiet take-over (optional)

A build that changes nothing the person can see is not worth a banner. Give `startAppUpdates` the running version and a
function that says whether the app's changelog has news since it:

```ts
startAppUpdates(deps, {
  version: APP_VERSION,
  hasNewsSince: (version) => entriesSince(changelog, version).length > 0,
});
```

When a build waits and `hasNewsSince(version)` is false, it is never offered (the state stays `'none'`): it takes over at
start-up, or the next time the app is hidden, and nothing reloads, so the next launch runs it. When it is true, the build
is offered as above. Without `hasNewsSince` the quiet take-over is off and every waiting build is offered (`version` alone does
nothing). `hasNewsSince` is asked when a build is found and again when the app is hidden; it should answer from what the app
already has, without waiting.

## API

| Export | What it is |
| --- | --- |
| `startAppUpdates(deps, options?)` | starts watching; returns `{ apply, checkNow, stop }` |
| `applyUpdate()` | the tap: takes over the waiting build and reloads once |
| `useUpdateState()` | React hook: `'none'`, `'ready'` or `'updating'` |
| `getUpdateState()` | the same state, for code outside React |
| `UPDATE_CHECK_EVERY_MS` | 30 minutes |
| `TAKE_OVER_PATIENCE_MS` | 10 seconds |
| `WorkerLike`, `UpdateContainer`, `UpdateRegistration` | the slices of the service worker API it needs, for fakes |
| `UpdateState`, `AppUpdates`, `AppUpdateOptions` | types |

The state is module-wide: one app, one registration.
