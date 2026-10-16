// <LaunchGate>: opens the app's store before the app draws, and does not leave the person staring at nothing. It says
// Opening…; after slowAfterMs a word that names what it waits on; from tryAgainAfterMs a Try again button; at timeoutMs or on
// a throw it says it failed, with Try again. Try again starts a fresh attempt with a fresh signal and ignores whatever the
// old one settles to later. It styles nothing: the app styles .bk-launch-gate, __word and __button.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LaunchTimeout, openWithin, type LaunchPhase } from './openWithin.js';

export interface LaunchWords {
  /** Said at once. Default 'Opening…'. */
  opening: string;
  /** Said after slowAfterMs. A string, or a function of waitingOn. Default 'Still waiting for <waitingOn>…', or 'Still opening…'. */
  slow: string | ((waitingOn?: string) => string);
  /** The button, from tryAgainAfterMs and after a failure. Default 'Try again'. */
  tryAgain: string;
  /** Said at the timeout, and after a throw that has no message. Default 'Could not open.' */
  failed: string;
}

export const DEFAULT_LAUNCH_WORDS: LaunchWords = {
  opening: 'Opening…',
  slow: (waitingOn) => (waitingOn ? `Still waiting for ${waitingOn}…` : 'Still opening…'),
  tryAgain: 'Try again',
  failed: 'Could not open.',
};

export interface LaunchTiming {
  slowAfterMs?: number;
  tryAgainAfterMs?: number;
  timeoutMs?: number;
}

export interface LaunchGateProps<T> {
  /** Opens the store, e.g. `() => db.open().then(() => db)`; it should stop when the signal aborts. */
  open: (signal: AbortSignal) => Promise<T>;
  words?: Partial<LaunchWords>;
  /** What the slow word names, e.g. 'your notes'. */
  waitingOn?: string;
  timing?: LaunchTiming;
  /** The app, drawn with what `open` resolved to. */
  children: (value: T) => ReactNode;
}

type State<T> = { kind: 'pending'; phase: 'opening' | 'slow' | 'retryable' } | { kind: 'failed'; message: string | null } | { kind: 'open'; value: T };

export function LaunchGate<T>({ open, words, waitingOn, timing, children }: LaunchGateProps<T>) {
  const word = { ...DEFAULT_LAUNCH_WORDS, ...words };
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State<T>>({ kind: 'pending', phase: 'opening' });
  // the latest open and timing, read when an attempt starts, so a new function from a re-render does not restart the open
  const latest = useRef({ open, timing });
  latest.current = { open, timing };

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState({ kind: 'pending', phase: 'opening' });
    const onPhase = (phase: LaunchPhase): void => {
      if (current && phase !== 'failed') setState({ kind: 'pending', phase });
    };
    openWithin(latest.current.open, { ...latest.current.timing, signal: controller.signal, onPhase }).then(
      (value) => {
        if (current) setState({ kind: 'open', value });
      },
      (error: unknown) => {
        if (!current) return;
        const message = !(error instanceof LaunchTimeout) && error instanceof Error && error.message ? error.message : null;
        setState({ kind: 'failed', message });
      },
    );
    return () => {
      current = false;
      controller.abort();
    };
  }, [attempt]);

  const tryAgain = useCallback(() => setAttempt((n) => n + 1), []);

  if (state.kind === 'open') return <>{children(state.value)}</>;

  let said: string;
  if (state.kind === 'failed') said = state.message ?? word.failed;
  else if (state.phase === 'opening') said = word.opening;
  else said = typeof word.slow === 'function' ? word.slow(waitingOn) : word.slow;

  const offerTryAgain = state.kind === 'failed' || state.phase === 'retryable';
  return (
    <div className="bk-launch-gate">
      <p className="bk-launch-gate__word" role="status">
        {said}
      </p>
      {offerTryAgain ? (
        <button type="button" className="bk-launch-gate__button" onClick={tryAgain}>
          {word.tryAgain}
        </button>
      ) : null}
    </div>
  );
}
