// @vitest-environment jsdom
// The tap guard (a second tap within 300 ms of an accepted one is swallowed), useSettled (a control just drawn ignores
// taps for 300 ms) and the seam tapSettings.ms; and the bug they fix, shown on a jsdom screen: a first tap opens a
// sheet, the second tap of a double tap lands on its backdrop and closes it again.
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_SETTLE_MS, createTapGuard, tapSettings, useSettled, useTapGuard } from '../src/index.js';
import { twoTaps } from '../src/testing.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  tapSettings.ms = TAP_SETTLE_MS;
});

describe('createTapGuard', () => {
  it('runs a handler called twice 120 ms apart once', () => {
    const handler = vi.fn();
    const run = createTapGuard()(handler);
    run();
    vi.advanceTimersByTime(120);
    run();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs it twice when the calls are 301 ms apart', () => {
    const handler = vi.fn();
    const run = createTapGuard()(handler);
    run();
    vi.advanceTimersByTime(301);
    run();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('passes the handler its arguments', () => {
    const handler = vi.fn();
    createTapGuard()(handler)('a', 2);
    expect(handler).toHaveBeenCalledWith('a', 2);
  });

  it('is shared: a second tap on another control is swallowed too', () => {
    const open = vi.fn();
    const close = vi.fn();
    const guard = createTapGuard();
    guard(open)();
    vi.advanceTimersByTime(120);
    guard(close)();
    expect(open).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('measures from the last accepted call, not the last swallowed one', () => {
    const handler = vi.fn();
    const run = createTapGuard()(handler);
    run();
    vi.advanceTimersByTime(200);
    run(); // swallowed
    vi.advanceTimersByTime(200); // 400 ms after the accepted call, 200 after the swallowed one
    run();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('takes its own settleMs', () => {
    const handler = vi.fn();
    const run = createTapGuard({ settleMs: 50 })(handler);
    run();
    vi.advanceTimersByTime(60);
    run();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('lets the second tap through when tapSettings.ms is 0', () => {
    tapSettings.ms = 0;
    const handler = vi.fn();
    const run = createTapGuard()(handler);
    run();
    run();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('reads the clock with performance.now, not Date.now', () => {
    const now = vi.spyOn(performance, 'now');
    const date = vi.spyOn(Date, 'now');
    createTapGuard()(() => {})();
    expect(now).toHaveBeenCalled();
    expect(date).not.toHaveBeenCalled();
  });
});

describe('useSettled', () => {
  it('is false at mount and true after settleMs', () => {
    const { result } = renderHook(() => useSettled());
    expect(result.current()).toBe(false);
    act(() => void vi.advanceTimersByTime(299));
    expect(result.current()).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current()).toBe(true);
  });

  it('restarts when the key changes', () => {
    const { result, rerender } = renderHook(({ k }) => useSettled(k), { initialProps: { k: 'one' } });
    act(() => void vi.advanceTimersByTime(400));
    expect(result.current()).toBe(true);
    rerender({ k: 'two' });
    expect(result.current()).toBe(false);
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current()).toBe(true);
  });

  it('does not restart on a rerender with the same key', () => {
    const { result, rerender } = renderHook(({ k }) => useSettled(k), { initialProps: { k: 'one' } });
    act(() => void vi.advanceTimersByTime(400));
    rerender({ k: 'one' });
    expect(result.current()).toBe(true);
  });

  it('returns the same function on every render', () => {
    const { result, rerender } = renderHook(() => useSettled());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('is settled at once when tapSettings.ms is 0', () => {
    tapSettings.ms = 0;
    const { result } = renderHook(() => useSettled());
    expect(result.current()).toBe(true);
  });
});

describe('useTapGuard', () => {
  it('keeps one guard for the life of the screen', () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(() => useTapGuard());
    result.current(handler)();
    rerender();
    vi.advanceTimersByTime(120);
    result.current(handler)();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('gives each screen its own guard', () => {
    const handler = vi.fn();
    const a = renderHook(() => useTapGuard());
    const b = renderHook(() => useTapGuard());
    a.result.current(handler)();
    b.result.current(handler)();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

// A button opens a sheet that sits over it; the sheet's backdrop closes it on a click.
function Screen({ guarded }: { guarded: boolean }) {
  const guard = useTapGuard();
  const g = <A extends unknown[]>(h: (...a: A) => void) => (guarded ? guard(h) : h);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={g(() => setOpen(true))}>Open</button>
      {open ? (
        <div data-testid="backdrop" onClick={g(() => setOpen(false))}>
          Sheet
        </div>
      ) : null}
    </div>
  );
}

describe('a double tap on a control that opens a sheet', () => {
  const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it('closes the sheet again when nothing guards it (the bug)', async () => {
    render(<Screen guarded={false} />);
    const { second } = await twoTaps(screen.getByText('Open'), () => screen.queryByTestId('backdrop'), { wait });
    expect(second).not.toBeNull();
    expect(screen.queryByTestId('backdrop')).toBeNull();
  });

  it('leaves the sheet open when both controls share useTapGuard', async () => {
    render(<Screen guarded />);
    const { second } = await twoTaps(screen.getByText('Open'), () => screen.queryByTestId('backdrop'), { wait });
    expect(second).not.toBeNull();
    expect(screen.getByTestId('backdrop')).toBeTruthy();
  });

  it('lets a deliberate second tap close it, 301 ms later', async () => {
    render(<Screen guarded />);
    await twoTaps(screen.getByText('Open'), () => screen.queryByTestId('backdrop'), { wait, gapMs: 301 });
    expect(screen.queryByTestId('backdrop')).toBeNull();
  });

  it('lets the second tap through when tapSettings.ms is 0', async () => {
    tapSettings.ms = 0;
    render(<Screen guarded />);
    await twoTaps(screen.getByText('Open'), () => screen.queryByTestId('backdrop'), { wait });
    expect(screen.queryByTestId('backdrop')).toBeNull();
  });
});

describe('a control just drawn', () => {
  it('ignores a tap until it has settled', () => {
    const onTap = vi.fn();
    function Card() {
      const settled = useSettled();
      return createElement('button', { onClick: () => settled() && onTap() }, 'Next');
    }
    render(createElement(Card));
    fireEvent.click(screen.getByText('Next'));
    expect(onTap).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText('Next'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
