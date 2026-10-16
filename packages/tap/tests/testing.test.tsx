// @vitest-environment jsdom
// twoTaps (jsdom) and twoTapsAt (Playwright, typed structurally: a fake page stands in for one).
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { twoTaps, twoTapsAt } from '../src/testing.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function button(label: string, log: string[]): HTMLButtonElement {
  const b = document.createElement('button');
  for (const type of ['pointerdown', 'pointerup', 'click']) b.addEventListener(type, () => log.push(`${label}:${type}`));
  document.body.append(b);
  return b;
}

describe('twoTaps', () => {
  it('dispatches pointerdown, pointerup and click on each, in order, gapMs apart', async () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const first = button('first', log);
    const under = button('under', log);
    const wait = vi.fn((ms: number) => {
      log.push(`wait:${ms}`);
      return vi.advanceTimersByTimeAsync(ms);
    });
    const { second } = await twoTaps(first, () => under, { wait });
    expect(second).toBe(under);
    expect(log).toEqual([
      'first:pointerdown', 'first:pointerup', 'first:click',
      'wait:120',
      'under:pointerdown', 'under:pointerup', 'under:click',
    ]);
  });

  it('takes its gap from gapMs', async () => {
    const wait = vi.fn(() => Promise.resolve());
    await twoTaps(button('a', []), () => null, { gapMs: 45, wait });
    expect(wait).toHaveBeenCalledWith(45);
  });

  it('asks under() once, after the wait', async () => {
    const log: string[] = [];
    const first = button('first', log);
    const under = vi.fn(() => {
      log.push('under()');
      return null;
    });
    await twoTaps(first, under, { wait: () => Promise.resolve(void log.push('wait')) });
    expect(under).toHaveBeenCalledTimes(1);
    expect(log.indexOf('wait')).toBeLessThan(log.indexOf('under()'));
  });

  it('taps nothing and returns null when nothing sits under the thumb', async () => {
    const log: string[] = [];
    const { second } = await twoTaps(button('first', log), () => null, { wait: () => Promise.resolve() });
    expect(second).toBeNull();
    expect(log).toEqual(['first:pointerdown', 'first:pointerup', 'first:click']);
  });

  it('really waits when given no wait()', async () => {
    const started = performance.now();
    await twoTaps(button('a', []), () => null, { gapMs: 30 });
    expect(performance.now() - started).toBeGreaterThanOrEqual(25); // a real clock, on purpose: the default wait is a setTimeout
  });
});

describe('twoTapsAt', () => {
  it('clicks the locator centre twice, gapMs apart', async () => {
    const calls: string[] = [];
    const page = { mouse: { click: vi.fn((x: number, y: number) => Promise.resolve(void calls.push(`click:${x},${y}`))) } };
    const locator = { boundingBox: () => Promise.resolve({ x: 10, y: 20, width: 100, height: 40 }) };
    const started = performance.now();
    await twoTapsAt(page, locator, { gapMs: 30 });
    expect(page.mouse.click).toHaveBeenCalledTimes(2);
    expect(calls).toEqual(['click:60,40', 'click:60,40']);
    expect(performance.now() - started).toBeGreaterThanOrEqual(25); // the gap is a real setTimeout between two real clicks
  });

  it('says so when the locator is not on the page', async () => {
    const page = { mouse: { click: vi.fn(() => Promise.resolve()) } };
    await expect(twoTapsAt(page, { boundingBox: () => Promise.resolve(null) })).rejects.toThrow(/bounding box/);
    expect(page.mouse.click).not.toHaveBeenCalled();
  });
});
