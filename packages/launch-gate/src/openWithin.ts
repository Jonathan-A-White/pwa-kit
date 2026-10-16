// openWithin: opens something (the app's store) with a timeout, and says how long the wait has gone. The phases come from
// timers alone: opening at once, slow after slowAfterMs, retryable after tryAgainAfterMs, failed at timeoutMs or on a throw.
// Framework-free; <LaunchGate> is the React face of it.

export type LaunchPhase = 'opening' | 'slow' | 'retryable' | 'failed';

export interface OpenWithinOptions {
  /** When the wait is called slow. Default 3000. */
  slowAfterMs?: number;
  /** When the person is offered Try again, though the open is still going. Default 10000. */
  tryAgainAfterMs?: number;
  /** When the open is given up: its signal is aborted and openWithin rejects with a LaunchTimeout. Default 15000. */
  timeoutMs?: number;
  /** Called with each phase as it is reached; never after the open has settled. */
  onPhase?: (phase: LaunchPhase) => void;
  /** Abort it to stop waiting: the timers are cleared, the attempt's signal is aborted and openWithin rejects with the reason. */
  signal?: AbortSignal;
}

/** The open did not finish within timeoutMs. */
export class LaunchTimeout extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Opening took longer than ${timeoutMs} ms`);
    this.name = 'LaunchTimeout';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Calls `open` with a signal that is aborted at the timeout (or when `options.signal` aborts), and resolves to its value,
 * or rejects with a LaunchTimeout or the open's own error. Whatever the open settles to after that is ignored.
 */
export function openWithin<T>(open: (signal: AbortSignal) => Promise<T>, options: OpenWithinOptions = {}): Promise<T> {
  const { slowAfterMs = 3000, tryAgainAfterMs = 10000, timeoutMs = 15000, onPhase, signal: outer } = options;
  const attempt = new AbortController();
  return new Promise<T>((resolve, reject) => {
    if (outer?.aborted) {
      reject(outer.reason);
      return;
    }
    let settled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const settle = (done: () => void): void => {
      settled = true;
      timers.forEach(clearTimeout);
      outer?.removeEventListener('abort', onOuterAbort);
      done();
    };
    const phase = (p: LaunchPhase): void => {
      if (!settled) onPhase?.(p);
    };
    const onOuterAbort = (): void => {
      if (settled) return;
      attempt.abort(outer?.reason);
      settle(() => reject(outer?.reason));
    };
    outer?.addEventListener('abort', onOuterAbort);

    phase('opening');
    timers.push(setTimeout(() => phase('slow'), slowAfterMs));
    timers.push(setTimeout(() => phase('retryable'), tryAgainAfterMs));
    timers.push(
      setTimeout(() => {
        const error = new LaunchTimeout(timeoutMs);
        phase('failed');
        attempt.abort(error);
        settle(() => reject(error));
      }, timeoutMs),
    );

    new Promise<T>((r) => r(open(attempt.signal))).then(
      (value) => {
        if (!settled) settle(() => resolve(value));
      },
      (error: unknown) => {
        if (settled) return;
        phase('failed');
        settle(() => reject(error));
      },
    );
  });
}
