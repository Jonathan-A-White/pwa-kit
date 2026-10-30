// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { browserPage } from '../src/index.js';

// the package is typed without the DOM library, so the page's globals are reached the way the source reaches them
const dom = globalThis as unknown as {
  navigator: { onLine: boolean };
  document: { hidden: boolean; dispatchEvent(event: unknown): boolean };
  window: { dispatchEvent(event: unknown): boolean };
  Event: new (type: string) => unknown;
};

describe('browserPage', () => {
  it('reads navigator.onLine and document.hidden', () => {
    const page = browserPage();
    expect(page.isOnline()).toBe(dom.navigator.onLine);
    expect(page.isVisible()).toBe(!dom.document.hidden);
  });

  it('wakes on online, offline and visibilitychange, and stops when unsubscribed', () => {
    const page = browserPage();
    const wake = vi.fn();
    const stop = page.subscribe(wake);
    dom.window.dispatchEvent(new dom.Event('online'));
    dom.window.dispatchEvent(new dom.Event('offline'));
    dom.document.dispatchEvent(new dom.Event('visibilitychange'));
    expect(wake).toHaveBeenCalledTimes(3);
    stop();
    dom.window.dispatchEvent(new dom.Event('online'));
    expect(wake).toHaveBeenCalledTimes(3);
  });
});
