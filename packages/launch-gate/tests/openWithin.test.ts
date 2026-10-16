// openWithin: the core of the launch gate, framework-free. Every test runs on fake timers; there is no real clock.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchTimeout, openWithin, type LaunchPhase } from '../src/index.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const never = () => new Promise<never>(() => {});

describe('openWithin', () => {
  it('resolves to the value the open resolves to, and leaves no timer behind', async () => {
    const phases: LaunchPhase[] = [];
    await expect(openWithin(async () => 42, { onPhase: (p) => phases.push(p) })).resolves.toBe(42);
    expect(phases).toEqual(['opening']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('says opening at once, slow at 3000 ms, retryable at 10000 ms and failed at 15000 ms with a LaunchTimeout', async () => {
    const phases: LaunchPhase[] = [];
    const result = openWithin(never, { onPhase: (p) => phases.push(p) });
    const settled = result.catch((e: unknown) => e);
    expect(phases).toEqual(['opening']);
    await vi.advanceTimersByTimeAsync(2999);
    expect(phases).toEqual(['opening']);
    await vi.advanceTimersByTimeAsync(1);
    expect(phases).toEqual(['opening', 'slow']);
    await vi.advanceTimersByTimeAsync(6999);
    expect(phases).toEqual(['opening', 'slow']);
    await vi.advanceTimersByTimeAsync(1);
    expect(phases).toEqual(['opening', 'slow', 'retryable']);
    await vi.advanceTimersByTimeAsync(4999);
    expect(phases).toEqual(['opening', 'slow', 'retryable']);
    await vi.advanceTimersByTimeAsync(1);
    expect(phases).toEqual(['opening', 'slow', 'retryable', 'failed']);
    const error = await settled;
    expect(error).toBeInstanceOf(LaunchTimeout);
    expect((error as LaunchTimeout).timeoutMs).toBe(15000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts the attempt\'s signal at the timeout, and not before', async () => {
    let seen: AbortSignal | undefined;
    const settled = openWithin((signal) => ((seen = signal), never())).catch(() => {});
    await vi.advanceTimersByTimeAsync(14999);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen?.aborted).toBe(true);
    expect(seen?.reason).toBeInstanceOf(LaunchTimeout);
    await settled;
  });

  it('takes its times from the options', async () => {
    const phases: LaunchPhase[] = [];
    const settled = openWithin(never, { slowAfterMs: 10, tryAgainAfterMs: 20, timeoutMs: 30, onPhase: (p) => phases.push(p) }).catch(() => {});
    await vi.advanceTimersByTimeAsync(30);
    expect(phases).toEqual(['opening', 'slow', 'retryable', 'failed']);
    await settled;
  });

  it('rejects with the open\'s own error, says failed and clears its timers', async () => {
    const boom = new Error('the store is locked');
    const phases: LaunchPhase[] = [];
    const settled = openWithin(async () => { throw boom; }, { onPhase: (p) => phases.push(p) });
    await expect(settled).rejects.toBe(boom);
    expect(phases).toEqual(['opening', 'failed']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with the error of an open that throws before returning a promise', async () => {
    const boom = new Error('sync');
    await expect(openWithin(() => { throw boom; })).rejects.toBe(boom);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores an open that settles after the timeout', async () => {
    let resolveOpen: (v: string) => void = () => {};
    const settled = openWithin(() => new Promise<string>((r) => (resolveOpen = r))).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await settled).toBeInstanceOf(LaunchTimeout);
    resolveOpen('late');
    await vi.advanceTimersByTimeAsync(1);
  });

  it('stops, clears its timers and calls no more phases when the caller\'s signal aborts, aborting the attempt\'s signal', async () => {
    const outer = new AbortController();
    const phases: LaunchPhase[] = [];
    let seen: AbortSignal | undefined;
    const settled = openWithin((s) => ((seen = s), never()), { signal: outer.signal, onPhase: (p) => phases.push(p) }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3000);
    outer.abort();
    expect(seen?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(await settled).toBeInstanceOf(Error);
    await vi.advanceTimersByTimeAsync(20000);
    expect(phases).toEqual(['opening', 'slow']);
  });

  it('does not call open when the caller\'s signal is already aborted', async () => {
    const outer = new AbortController();
    outer.abort();
    const open = vi.fn(async () => 1);
    await expect(openWithin(open, { signal: outer.signal })).rejects.toBeInstanceOf(Error);
    expect(open).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
