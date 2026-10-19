// @vitest-environment jsdom
// The update state machine, network-free: a fake container and registration stand in for the browser's, and fake timers
// stand in for the wall clock.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TAKE_OVER_PATIENCE_MS,
  UPDATE_CHECK_EVERY_MS,
  applyUpdate,
  getUpdateState,
  startAppUpdates,
  type UpdateContainer,
  type UpdateRegistration,
  type WorkerLike,
} from '../src/index.js';

class FakeWorker implements WorkerLike {
  state: ServiceWorkerState = 'installed';
  messages: unknown[] = [];
  private listeners: Array<() => void> = [];
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.push(listener);
  }
  become(state: ServiceWorkerState): void {
    this.state = state;
    for (const l of [...this.listeners]) l();
  }
}

class FakeContainer implements UpdateContainer {
  controller: unknown = {};
  private listeners = new Set<() => void>();
  addEventListener(_type: 'controllerchange', listener: () => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'controllerchange', listener: () => void): void {
    this.listeners.delete(listener);
  }
  takeOver(): void {
    for (const l of [...this.listeners]) l();
  }
  get count(): number {
    return this.listeners.size;
  }
}

class FakeRegistration implements UpdateRegistration {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updates = 0;
  failUpdate = false;
  private found = new Set<() => void>();
  update(): Promise<unknown> {
    this.updates++;
    return this.failUpdate ? Promise.reject(new Error('offline')) : Promise.resolve();
  }
  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.found.add(listener);
  }
  removeEventListener(_type: 'updatefound', listener: () => void): void {
    this.found.delete(listener);
  }
  install(worker: FakeWorker): void {
    this.installing = worker;
    for (const l of [...this.found]) l();
    this.waiting = worker;
    this.installing = null;
    worker.become('installed');
  }
}

const setVisibility = (value: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  document.dispatchEvent(new Event('visibilitychange'));
};

let container: FakeContainer;
let registration: FakeRegistration;
let reload: ReturnType<typeof vi.fn<() => void>>;
let stops: Array<() => void>;

const start = (options?: Parameters<typeof startAppUpdates>[1]) => {
  const updates = startAppUpdates({ container, registration, reload }, options);
  stops.push(updates.stop);
  return updates;
};
const waitingWorker = () => {
  const worker = new FakeWorker();
  registration.waiting = worker;
  return worker;
};

beforeEach(() => {
  vi.useFakeTimers();
  container = new FakeContainer();
  registration = new FakeRegistration();
  reload = vi.fn<() => void>();
  stops = [];
  setVisibility('visible');
});
afterEach(() => {
  for (const stop of stops) stop();
  vi.useRealTimers();
});

describe('offering a waiting build', () => {
  it('is none until a build waits, then ready once it installs', () => {
    start();
    expect(getUpdateState()).toBe('none');
    registration.install(new FakeWorker());
    expect(getUpdateState()).toBe('ready');
  });

  it('offers a build already waiting at start-up', () => {
    waitingWorker();
    start();
    expect(getUpdateState()).toBe('ready');
  });

  it('never offers the first worker ever, which has nothing to wait behind', () => {
    container.controller = null;
    waitingWorker();
    start();
    expect(getUpdateState()).toBe('none');
  });

  it('applyUpdate with nothing ready does nothing', () => {
    start();
    applyUpdate();
    expect(getUpdateState()).toBe('none');
  });

  it('looks for a new build on start, on return to the foreground and every 30 minutes, and survives being offline', async () => {
    registration.failUpdate = true;
    start();
    expect(registration.updates).toBe(1);
    setVisibility('hidden');
    expect(registration.updates).toBe(1);
    setVisibility('visible');
    expect(registration.updates).toBe(2);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_EVERY_MS);
    expect(registration.updates).toBe(3);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_EVERY_MS);
    expect(registration.updates).toBe(4);
  });
});

describe('applying the update', () => {
  it('posts SKIP_WAITING and says updating', () => {
    const worker = waitingWorker();
    start();
    applyUpdate();
    expect(worker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(getUpdateState()).toBe('updating');
  });

  it('reloads once after TAKE_OVER_PATIENCE_MS when no controllerchange comes', () => {
    waitingWorker();
    start();
    applyUpdate();
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS - 1);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once on controllerchange before the patience, and the timer does not reload again', () => {
    waitingWorker();
    start();
    applyUpdate();
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS / 2);
    container.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(reload).toHaveBeenCalledTimes(1);
    container.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads on return to the foreground when the timer slept past the patience', () => {
    waitingWorker();
    start();
    applyUpdate();
    setVisibility('hidden');
    // the backgrounded tab's clock moves on but its timer never fires
    vi.setSystemTime(Date.now() + TAKE_OVER_PATIENCE_MS + 5_000);
    expect(reload).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload on return to the foreground before the patience is up', () => {
    waitingWorker();
    start();
    applyUpdate();
    setVisibility('hidden');
    setVisibility('visible');
    expect(reload).not.toHaveBeenCalled();
  });

  it('a controllerchange nobody asked for (a first install, another tab) never reloads', () => {
    start();
    container.takeOver();
    expect(reload).not.toHaveBeenCalled();
  });

  it('a second tap while updating does not post again or restart the patience', () => {
    const worker = waitingWorker();
    start();
    applyUpdate();
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS / 2);
    applyUpdate();
    expect(worker.messages).toHaveLength(1);
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS / 2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stop removes its listeners, clears the timers and goes back to none', () => {
    waitingWorker();
    const updates = start();
    applyUpdate();
    updates.stop();
    expect(container.count).toBe(0);
    expect(getUpdateState()).toBe('none');
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(reload).not.toHaveBeenCalled();
    const before = registration.updates;
    vi.advanceTimersByTime(UPDATE_CHECK_EVERY_MS * 2);
    expect(registration.updates).toBe(before);
  });

  it('starting again stops the first', () => {
    waitingWorker();
    start();
    start();
    expect(container.count).toBe(1);
  });
});

describe('the quiet take-over', () => {
  it('is off without version and hasNewsSince: a waiting build is always offered, and not taken over', () => {
    const worker = waitingWorker();
    start();
    expect(getUpdateState()).toBe('ready');
    setVisibility('hidden');
    expect(worker.messages).toEqual([]);
    expect(getUpdateState()).toBe('ready');
  });

  it('is off with a version alone', () => {
    const worker = waitingWorker();
    start({ version: '1.0.0' });
    expect(getUpdateState()).toBe('ready');
    expect(worker.messages).toEqual([]);
  });

  it('offers a build when hasNewsSince says there is news', () => {
    const worker = waitingWorker();
    const hasNewsSince = vi.fn(() => true);
    start({ version: '1.0.0', hasNewsSince });
    expect(hasNewsSince).toHaveBeenCalledWith('1.0.0');
    expect(getUpdateState()).toBe('ready');
    setVisibility('hidden');
    expect(worker.messages).toEqual([]);
  });

  it('takes a build with nothing new over at start-up, never offered, and without a reload', () => {
    const worker = waitingWorker();
    start({ version: '1.0.0', hasNewsSince: () => false });
    expect(getUpdateState()).toBe('none');
    expect(worker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    container.takeOver();
    vi.advanceTimersByTime(TAKE_OVER_PATIENCE_MS * 3);
    expect(reload).not.toHaveBeenCalled();
  });

  it('takes a build that installs while the app is open over when the app is hidden', () => {
    start({ version: '1.0.0', hasNewsSince: () => false });
    const worker = new FakeWorker();
    registration.install(worker);
    expect(getUpdateState()).toBe('none');
    expect(worker.messages).toEqual([]);
    setVisibility('hidden');
    expect(worker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    setVisibility('visible');
    setVisibility('hidden');
    expect(worker.messages).toHaveLength(1);
    container.takeOver();
    expect(reload).not.toHaveBeenCalled();
  });

  it('takes a build that installs while the app is hidden over at once', () => {
    start({ version: '1.0.0', hasNewsSince: () => false });
    setVisibility('hidden');
    const worker = new FakeWorker();
    registration.install(worker);
    expect(worker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(getUpdateState()).toBe('none');
  });

  it('never takes over the first worker ever', () => {
    container.controller = null;
    const worker = waitingWorker();
    start({ version: '1.0.0', hasNewsSince: () => false });
    expect(worker.messages).toEqual([]);
  });
});
