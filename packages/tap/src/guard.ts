// @pwa-kit/tap: the tap guard, the framework-free core. A tap that opens a sheet, closes one or moves the view puts a
// different control under the thumb; the second tap of a double tap, 120 ms later, lands on it. The guard swallows that
// second tap, wherever it lands, when it comes within settleMs of the last tap the guard accepted.

/** How long the guard swallows a second tap, and how long a control just drawn ignores taps. Reading a screen takes longer; a double tap is about 120 ms. PROVISIONAL */
export const TAP_SETTLE_MS = 300;

/**
 * The moment the guard and `useSettled` settle for. A seam: a test or an e2e run may set `ms` (0 = no settle, so a step
 * may tap the instant a control is drawn, and a second tap always gets through); a test of the guard sets it back to
 * `TAP_SETTLE_MS`. In a browser it starts from `localStorage['pwa-kit:tapSettleMs']` when that holds a number of 0 or more
 * (an e2e run sets it before the page loads), else 300.
 */
export const tapSettings = { ms: readStored() };

function readStored(): number {
  try {
    const raw = globalThis.localStorage?.getItem('pwa-kit:tapSettleMs');
    const stored = Number(raw);
    return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(stored) && stored >= 0 ? stored : TAP_SETTLE_MS;
  } catch {
    return TAP_SETTLE_MS;
  }
}

export interface TapGuardOptions {
  /** How long after an accepted call a second one is swallowed. Default: `tapSettings.ms`, read at each call. */
  settleMs?: number;
}

export type TapGuard = <A extends unknown[]>(handler: (...args: A) => void) => (...args: A) => void;

/**
 * Makes a guard. `guard(handler)` returns a handler that runs `handler` at most once within settleMs of the last call
 * this guard accepted, from any handler it wrapped: share one guard between every control on a screen that opens,
 * closes or moves the view, so the second tap of a double tap is swallowed wherever it lands.
 */
export function createTapGuard(options: TapGuardOptions = {}): TapGuard {
  // performance.now(), never the wall clock: a clock that steps back (a dev box, a phone changing zone) must not stretch or end the moment
  let acceptedAt = -Infinity;
  return (handler) =>
    (...args) => {
      const now = performance.now();
      if (now - acceptedAt < (options.settleMs ?? tapSettings.ms)) return;
      acceptedAt = now;
      handler(...args);
    };
}
