// @vitest-environment jsdom
// useAlive(): true while the component is mounted, false once it has unmounted; a setState guarded by it survives a
// promise that settles after the page is torn down (mw-ev7oyy.21).
import { createElement, useEffect, useState, StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { settleAfterTeardown } from 'pwa-kit/test-preset';
import { useAlive } from '../src/index.js';

afterEach(cleanup);

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useAlive', () => {
  it('is true while mounted and false after unmount', () => {
    let alive: (() => boolean) | undefined;
    function Probe() {
      alive = useAlive();
      return null;
    }
    const { unmount } = render(createElement(Probe));
    expect(alive?.()).toBe(true);
    unmount();
    expect(alive?.()).toBe(false);
  });

  it('is true again after StrictMode runs the effect twice', () => {
    let alive: (() => boolean) | undefined;
    function Probe() {
      alive = useAlive();
      return null;
    }
    const { unmount } = render(createElement(StrictMode, null, createElement(Probe)));
    expect(alive?.()).toBe(true);
    unmount();
    expect(alive?.()).toBe(false);
  });

  it('returns the same function on every render', () => {
    const seen = new Set<() => boolean>();
    function Probe() {
      seen.add(useAlive());
      const [, set] = useState(0);
      useEffect(() => set(1), []);
      return null;
    }
    render(createElement(Probe));
    expect(seen.size).toBe(1);
  });
});

describe('a setState after an await', () => {
  function Screen({ answer, guarded }: { answer: Promise<string>; guarded: boolean }) {
    const alive = useAlive();
    const [text, setText] = useState('loading');
    useEffect(() => {
      void answer.then((x) => {
        if (!guarded || alive()) setText(x);
      });
    }, [answer, guarded, alive]);
    return createElement('p', null, text);
  }

  it('raises window is not defined when unguarded and the screen has closed', async () => {
    const d = deferred<string>();
    const { unmount } = render(createElement(Screen, { answer: d.promise, guarded: false }));
    unmount();
    const raised = await settleAfterTeardown(() => d.resolve('late'));
    expect(raised.map((e) => (e as Error).message)).toEqual([expect.stringContaining('window is not defined')]);
  });

  it('raises nothing when guarded by useAlive', async () => {
    const d = deferred<string>();
    const { unmount } = render(createElement(Screen, { answer: d.promise, guarded: true }));
    unmount();
    expect(await settleAfterTeardown(() => d.resolve('late'))).toEqual([]);
  });
});
