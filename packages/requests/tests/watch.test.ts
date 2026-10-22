import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchStatuses, type Visibility } from '../src/index.js';

function fakePage(hidden = false): Visibility & { hidden: boolean; show(): void } {
  let listener: (() => void) | undefined;
  const page = {
    hidden,
    addEventListener: (_t: 'visibilitychange', l: () => void) => void (listener = l),
    removeEventListener: () => void (listener = undefined),
    show() {
      page.hidden = false;
      listener?.();
    },
  };
  return page;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('watchStatuses', () => {
  it('asks at once and then every so often, until stopped', async () => {
    const refresh = vi.fn(async () => undefined);
    const stop = watchStatuses(refresh, { everyMs: 1000, page: fakePage() });
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2500);
    expect(refresh).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('never asks while the page is hidden, and asks at once when it is shown', async () => {
    const refresh = vi.fn(async () => undefined);
    const page = fakePage(true);
    const stop = watchStatuses(refresh, { everyMs: 1000, page });
    await vi.advanceTimersByTimeAsync(3500);
    expect(refresh).not.toHaveBeenCalled();
    page.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
  });

  it('tells whether the last ask failed, and keeps asking', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue(undefined);
    const results: boolean[] = [];
    const stop = watchStatuses(refresh, { everyMs: 1000, page: fakePage(), onResult: (failed) => results.push(failed) });
    await vi.advanceTimersByTimeAsync(1500);
    expect(results).toEqual([true, false]);
    stop();
  });
});
