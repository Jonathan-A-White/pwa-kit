// @vitest-environment jsdom
// <LaunchGate>: the opening word, the slow word naming what it waits on, Try again, the failed word. Fake timers throughout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { LaunchGate } from '../src/index.js';

const never = () => new Promise<never>(() => {});
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const tryAgain = () => screen.queryByRole('button', { name: 'Try again' });

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  vi.useRealTimers();
});

describe('<LaunchGate>', () => {
  it('renders the children with the opened value and no word when the open resolves at once', async () => {
    render(<LaunchGate open={async () => 'the db'}>{(db) => <p>app on {db}</p>}</LaunchGate>);
    await tick(0);
    expect(screen.getByText('app on the db')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(tryAgain()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the opening word at 2999 ms, the slow word naming waitingOn at 3000 ms and a Try again button at 10000 ms', async () => {
    render(<LaunchGate open={never} waitingOn="your notes">{() => <p>app</p>}</LaunchGate>);
    expect(screen.getByRole('status').textContent).toBe('Opening…');
    await tick(2999);
    expect(screen.getByRole('status').textContent).toBe('Opening…');
    expect(tryAgain()).toBeNull();
    await tick(1);
    expect(screen.getByRole('status').textContent).toBe('Still waiting for your notes…');
    expect(tryAgain()).toBeNull();
    await tick(6999);
    expect(tryAgain()).toBeNull();
    await tick(1);
    expect(tryAgain()).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Still waiting for your notes…');
    expect(screen.queryByText('app')).toBeNull();
  });

  it('says a plain slow word when it is not told what it waits on', async () => {
    render(<LaunchGate open={never}>{() => <p>app</p>}</LaunchGate>);
    await tick(3000);
    expect(screen.getByRole('status').textContent).toBe('Still opening…');
  });

  it('says the failed word and offers Try again at 15000 ms', async () => {
    render(<LaunchGate open={never}>{() => <p>app</p>}</LaunchGate>);
    await tick(14999);
    expect(screen.getByRole('status').textContent).not.toBe('Could not open.');
    await tick(1);
    expect(screen.getByRole('status').textContent).toBe('Could not open.');
    expect(tryAgain()).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the message of an open that throws, and Try again', async () => {
    render(<LaunchGate open={async () => { throw new Error('the store is locked'); }}>{() => <p>app</p>}</LaunchGate>);
    await tick(0);
    expect(screen.getByRole('status').textContent).toBe('the store is locked');
    expect(tryAgain()).toBeTruthy();
  });

  it('says the failed word for a throw that has no message', async () => {
    render(<LaunchGate open={() => Promise.reject<string>(undefined)} words={{ failed: 'Nope.' }}>{() => <p>app</p>}</LaunchGate>);
    await tick(0);
    expect(screen.getByRole('status').textContent).toBe('Nope.');
  });

  it('Try again calls open again with a new signal, aborts the first, and ignores the first attempt settling later', async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(v: string) => void> = [];
    const open = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>((r) => resolvers.push(r));
    });
    render(<LaunchGate open={open}>{(v) => <p>app on {v}</p>}</LaunchGate>);
    await tick(10000);
    fireEvent.click(tryAgain()!);
    await tick(0);
    expect(open).toHaveBeenCalledTimes(2);
    expect(signals[1]).not.toBe(signals[0]);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('Opening…');
    expect(tryAgain()).toBeNull();

    await act(async () => resolvers[0]('first'));
    expect(screen.queryByText(/app on/)).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Opening…');

    await act(async () => resolvers[1]('second'));
    expect(screen.getByText('app on second')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Try again after a failure opens again and shows the app when that works', async () => {
    const open = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('locked')).mockResolvedValueOnce('ok');
    render(<LaunchGate open={open}>{(v) => <p>app on {v}</p>}</LaunchGate>);
    await tick(0);
    expect(screen.getByRole('status').textContent).toBe('locked');
    fireEvent.click(tryAgain()!);
    await tick(0);
    expect(screen.getByText('app on ok')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('leaves no timer and no React warning when unmounted while pending', async () => {
    const { unmount } = render(<LaunchGate open={never}>{() => <p>app</p>}</LaunchGate>);
    await tick(3000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await tick(20000);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('sets no state when the open settles after unmount', async () => {
    let resolveOpen: (v: string) => void = () => {};
    const { unmount } = render(<LaunchGate open={() => new Promise<string>((r) => (resolveOpen = r))}>{() => <p>app</p>}</LaunchGate>);
    unmount();
    await act(async () => resolveOpen('late'));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('takes every word from words, and a slow word that is told what it waits on', async () => {
    const words = { opening: 'Une seconde', slow: (w?: string) => `Encore ${w}`, tryAgain: 'Réessayer', failed: 'Échec' };
    render(<LaunchGate open={never} words={words} waitingOn="la base">{() => <p>app</p>}</LaunchGate>);
    expect(screen.getByRole('status').textContent).toBe('Une seconde');
    await tick(3000);
    expect(screen.getByRole('status').textContent).toBe('Encore la base');
    await tick(7000);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
    await tick(5000);
    expect(screen.getByRole('status').textContent).toBe('Échec');
  });

  it('takes a plain string as the slow word', async () => {
    render(<LaunchGate open={never} words={{ slow: 'Hang on' }} waitingOn="x">{() => <p>app</p>}</LaunchGate>);
    await tick(3000);
    expect(screen.getByRole('status').textContent).toBe('Hang on');
  });

  it('takes its times from timing', async () => {
    render(<LaunchGate open={never} timing={{ slowAfterMs: 1, tryAgainAfterMs: 2, timeoutMs: 3 }}>{() => <p>app</p>}</LaunchGate>);
    await tick(3);
    expect(screen.getByRole('status').textContent).toBe('Could not open.');
  });

  it('puts the bk- class names on the gate, the word and the button, and no other styling', async () => {
    const { container } = render(<LaunchGate open={never}>{() => <p>app</p>}</LaunchGate>);
    await tick(10000);
    expect(container.querySelector('div.bk-launch-gate')).toBeTruthy();
    expect(container.querySelector('.bk-launch-gate > .bk-launch-gate__word[role="status"]')).toBeTruthy();
    const button = container.querySelector('button.bk-launch-gate__button');
    expect(button?.getAttribute('type')).toBe('button');
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('works under StrictMode, which runs the effect twice', async () => {
    const open = vi.fn(async () => 'db');
    render(<StrictMode><LaunchGate open={open}>{(v) => <p>app on {v}</p>}</LaunchGate></StrictMode>);
    await tick(0);
    expect(screen.getByText('app on db')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
