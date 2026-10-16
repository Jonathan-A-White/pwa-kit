// @pwa-kit/tap: a shared tap guard and the React hooks for it. The two-tap test helper is pwa-kit/tap/testing.
import { useCallback, useEffect, useRef } from 'react';
import { createTapGuard, tapSettings } from './guard.js';
import type { TapGuard, TapGuardOptions } from './guard.js';

export { TAP_SETTLE_MS, createTapGuard, tapSettings } from './guard.js';
export type { TapGuard, TapGuardOptions } from './guard.js';

/** One guard for a mounted screen: the same guard on every render, a fresh one for each screen. Wrap every control that opens, closes or moves the view in it. */
export function useTapGuard(options: TapGuardOptions = {}): TapGuard {
  const guard = useRef<TapGuard | null>(null);
  guard.current ??= createTapGuard(options);
  return guard.current;
}

/**
 * Returns `settled()`: true once the control has been up for `tapSettings.ms`, so a tap in the moment it is drawn does
 * nothing. The clock restarts when `key` changes (a card that stays mounted for the next question). The function is the
 * same on every render.
 */
export function useSettled(key: unknown = 0): () => boolean {
  // performance.now(), never the wall clock: see createTapGuard
  const since = useRef(performance.now());
  useEffect(() => {
    since.current = performance.now();
  }, [key]);
  return useCallback(() => performance.now() - since.current >= tapSettings.ms, []);
}
