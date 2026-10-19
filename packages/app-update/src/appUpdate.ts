// The update state machine for a PWA. A new build waits behind the one in control until the person taps: the app's banner
// shows while a worker is waiting (useUpdateState), the tap (applyUpdate) posts {type:'SKIP_WAITING'} to it (the app's
// service worker skips waiting and, on activate, claims the windows) and the page reloads ONCE when the controller
// changes, only if the person asked: a first install claiming the page, or another tab's update, never reloads this one.
// If the new build has not taken over within TAKE_OVER_PATIENCE_MS the page reloads anyway, so an update never hangs on
// 'Updating…'. The app also asks the browser whether there is a new build on start, on return to the foreground and every
// 30 minutes, so a phone that keeps the app open for days still finds out.
//
// Optionally (the options' hasNewsSince) a waiting build with nothing new in it is never offered: it takes over quietly at
// start-up, or when the app is hidden, and nothing reloads. Lifted from Postern's appUpdate.ts at 0.8.26.
import { useSyncExternalStore } from 'react';

/** How often a running app asks whether a newer build is up. */
export const UPDATE_CHECK_EVERY_MS = 30 * 60_000;

/** How long a tap waits for the new worker to take over before the page reloads anyway. */
export const TAKE_OVER_PATIENCE_MS = 10_000;

export type UpdateState = 'none' | 'ready' | 'updating';

export interface WorkerLike {
  state: ServiceWorkerState;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface UpdateContainer {
  controller: unknown;
  addEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface UpdateRegistration {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  update(): Promise<unknown>;
  addEventListener(type: 'updatefound', listener: () => void): void;
  removeEventListener(type: 'updatefound', listener: () => void): void;
}

export interface AppUpdateOptions {
  /** The running build's version, handed to `hasNewsSince`. */
  version?: string;
  /**
   * Whether the app's changelog has news for the person since `version`. Given, a waiting build for which it says false is
   * never offered: it takes over quietly at start-up, or when the app is hidden, with no reload. Not given, the quiet
   * take-over is off and every waiting build is offered.
   */
  hasNewsSince?: (version: string) => boolean;
}

export interface AppUpdates {
  /** Tells the waiting worker to take over; the page reloads once it has. */
  apply(): void;
  /** Asks the browser now whether a newer build is up. */
  checkNow(): void;
  stop(): void;
}

let state: UpdateState = 'none';
let active: AppUpdates | undefined;
const listeners = new Set<() => void>();

function setState(next: UpdateState): void {
  if (state === next) return;
  state = next;
  for (const listener of [...listeners]) listener();
}

/** The banner's current state, for code outside React. */
export function getUpdateState(): UpdateState {
  return state;
}

/** The banner's state: nothing waiting, a build ready to take, or the tap made and the worker taking over. */
export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => state,
  );
}

/** The tap on the banner. */
export function applyUpdate(): void {
  active?.apply();
}

/** Watches `registration` for a waiting worker and looks for a newer build now, on return to the foreground and every 30 minutes. */
export function startAppUpdates(
  deps: { container: UpdateContainer; registration: UpdateRegistration; reload: () => void },
  options: AppUpdateOptions = {},
): AppUpdates {
  const { container, registration, reload } = deps;
  const { version = '', hasNewsSince } = options;
  active?.stop();
  let asked = false;
  let patience: ReturnType<typeof setTimeout> | undefined;
  let giveUpAt = 0;
  // A waiting build with nothing new, kept for when the app is hidden; and the one already taken over, never posted twice.
  let quietWaiting: WorkerLike | undefined;
  let tookOver: WorkerLike | undefined;

  const hidden = () => document.visibilityState === 'hidden';

  const takeOverQuietly = (worker: WorkerLike) => {
    quietWaiting = undefined;
    if (tookOver === worker) return;
    tookOver = worker;
    worker.postMessage({ type: 'SKIP_WAITING' });
  };

  const syncWaiting = (atStart = false) => {
    const worker = registration.waiting;
    // The first worker ever has nothing to wait behind: it activates, and claims the page.
    if (worker && container.controller) {
      if (state !== 'none' || asked) return;
      if (hasNewsSince && !hasNewsSince(version)) {
        if (atStart || hidden()) takeOverQuietly(worker);
        else if (tookOver !== worker) quietWaiting = worker;
      } else setState('ready');
    } else if (!asked) {
      quietWaiting = undefined;
      setState('none');
    }
  };

  const onFound = () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') syncWaiting();
    });
  };

  // Once, whichever comes first: the new worker took control, or the patience ran out.
  const reloadOnce = () => {
    if (!asked) return;
    asked = false;
    clearTimeout(patience);
    reload();
  };
  const onControllerChange = reloadOnce;

  const checkNow = () => {
    // Offline, or the server is down: the next check tries again.
    void Promise.resolve(registration.update()).catch(() => undefined);
  };
  const onVisibility = () => {
    if (hidden()) {
      // The app is out of sight: a build with nothing new takes over now, unless the changelog has news by now.
      if (quietWaiting) syncWaiting(true);
      return;
    }
    if (document.visibilityState !== 'visible') return;
    // A backgrounded tab's timer can sleep past its time: on return, an overdue update reloads now.
    if (asked && Date.now() >= giveUpAt) reloadOnce();
    checkNow();
  };

  registration.addEventListener('updatefound', onFound);
  container.addEventListener('controllerchange', onControllerChange);
  document.addEventListener('visibilitychange', onVisibility);
  const every = setInterval(checkNow, UPDATE_CHECK_EVERY_MS);
  onFound();
  syncWaiting(true);
  checkNow();

  const updates: AppUpdates = {
    apply() {
      const worker = registration.waiting;
      if (state !== 'ready' || !worker) return;
      asked = true;
      setState('updating');
      worker.postMessage({ type: 'SKIP_WAITING' });
      clearTimeout(patience);
      giveUpAt = Date.now() + TAKE_OVER_PATIENCE_MS;
      patience = setTimeout(reloadOnce, TAKE_OVER_PATIENCE_MS);
    },
    checkNow,
    stop() {
      registration.removeEventListener('updatefound', onFound);
      container.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(every);
      clearTimeout(patience);
      if (active === updates) {
        active = undefined;
        asked = false;
        setState('none');
      }
    },
  };
  active = updates;
  return updates;
}
