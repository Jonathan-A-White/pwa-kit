// @vitest-environment jsdom
// The quiet take-over and the async news judge, network-free. The six quiet scenarios are ported from Lampas's
// tests/unit/app-update-quiet.test.ts (mw-5r3p30.236 and .304), with `hasNewsSince` standing in for Lampas's changelog read.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getUpdateState, startAppUpdates, type AppUpdates, type UpdateState } from '../src/index.js';

type Listener = () => void;

interface FakeWorker {
  state: ServiceWorkerState;
  postMessage: Mock<(message: unknown) => void>;
  addEventListener(type: 'statechange', listener: Listener): void;
  become(state: ServiceWorkerState): void;
}

function fakeWorker(state: ServiceWorkerState = 'installed'): FakeWorker {
  const listeners: Listener[] = [];
  const worker: FakeWorker = {
    state,
    postMessage: vi.fn<(message: unknown) => void>(),
    addEventListener: (_type, listener) => void listeners.push(listener),
    become(next) {
      worker.state = next;
      for (const listener of listeners) listener();
    },
  };
  return worker;
}

function fakeSetup(opts: { waiting?: FakeWorker | null } = {}) {
  const containerListeners: Listener[] = [];
  const registrationListeners: Listener[] = [];
  const setup = {
    container: {
      controller: {} as unknown,
      addEventListener: (_type: 'controllerchange', listener: Listener) => void containerListeners.push(listener),
      removeEventListener: (_type: 'controllerchange', listener: Listener) =>
        void containerListeners.splice(containerListeners.indexOf(listener), 1),
    },
    registration: {
      waiting: (opts.waiting ?? null) as FakeWorker | null,
      installing: null as FakeWorker | null,
      update: vi.fn(async () => undefined),
      addEventListener: (_type: 'updatefound', listener: Listener) => void registrationListeners.push(listener),
      removeEventListener: (_type: 'updatefound', listener: Listener) =>
        void registrationListeners.splice(registrationListeners.indexOf(listener), 1),
    },
    reload: vi.fn(),
    /** A new worker was found, finished installing and is now waiting behind the one in control. */
    newWorkerWaits(): FakeWorker {
      const worker = fakeWorker('installing');
      setup.registration.installing = worker;
      for (const listener of [...registrationListeners]) listener();
      setup.registration.waiting = worker;
      setup.registration.installing = null;
      worker.become('installed');
      return worker;
    },
    /** The waiting worker took control, so nothing waits any more. */
    controllerChanges(): void {
      setup.registration.waiting = null;
      for (const listener of [...containerListeners]) listener();
    },
  };
  return setup;
}

const RUNNING = '0.1.120';
let updates: AppUpdates | undefined;
let visibility: DocumentVisibilityState = 'visible';

function hide(): void {
  visibility = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
}
function show(): void {
  visibility = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
}
const settle = () => vi.advanceTimersByTimeAsync(0);
const stateOf = (): UpdateState => getUpdateState();

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  updates?.stop();
  vi.useRealTimers();
});

function start(setup: ReturnType<typeof fakeSetup>, hasNewsSince: (version: string) => boolean | Promise<boolean>) {
  updates = startAppUpdates(
    { container: setup.container, registration: setup.registration, reload: setup.reload },
    { version: RUNNING, hasNewsSince },
  );
}

describe('the news judge may answer now or later', () => {
  it('sync true: offers the build', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    const judge = vi.fn(() => true);
    start(setup, judge);
    expect(judge).toHaveBeenCalledWith(RUNNING);
    expect(stateOf()).toBe('ready');
    hide();
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('sync false: takes the build over quietly, never offered', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, () => false);
    expect(stateOf()).toBe('none');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('async true: offers the build once the judge has answered, and not before', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, async () => true);
    expect(stateOf()).toBe('none');
    await settle();
    expect(stateOf()).toBe('ready');
    hide();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(setup.reload).not.toHaveBeenCalled();
  });

  it('async false: takes the build over quietly, never offered', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, async () => false);
    await settle();
    expect(stateOf()).toBe('none');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('a rejection offers the build, and a hide does not take it over', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, async () => {
      throw new Error('offline');
    });
    await settle();
    expect(stateOf()).toBe('ready');
    hide();
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('a synchronous throw offers the build', () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, () => {
      throw new Error('broken');
    });
    expect(stateOf()).toBe('ready');
    hide();
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('a %s answer offers the build, and a hide does not take it over', async (answer) => {
    for (const judge of [() => answer, async () => answer]) {
      const worker = fakeWorker();
      const setup = fakeSetup({ waiting: worker });
      start(setup, judge as unknown as () => boolean);
      await settle();
      expect(stateOf()).toBe('ready');
      hide();
      expect(worker.postMessage).not.toHaveBeenCalled();
      show();
      updates?.stop();
    }
  });

  it('an answer that arrives after stop() does nothing', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    let answer!: (value: boolean) => void;
    start(setup, () => new Promise<boolean>((resolve) => (answer = resolve)));
    updates?.stop();
    answer(false);
    await settle();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(stateOf()).toBe('none');
  });

  it('is asked once per waiting worker', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    const judge = vi.fn(async () => true);
    start(setup, judge);
    await settle();
    hide();
    show();
    expect(judge).toHaveBeenCalledTimes(1);
  });
});

describe('a waiting build with nothing new to show (Lampas: app-update-quiet)', () => {
  it('shows no banner and takes over at start-up, then reloads once', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, async () => false);
    await settle();
    expect(stateOf()).toBe('none');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    setup.controllerChanges();
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('found while he is using the app, is left waiting until the app is hidden, and no reload happens while visible', async () => {
    const setup = fakeSetup();
    start(setup, async () => false);
    await settle();
    const worker = setup.newWorkerWaits();
    await settle();
    expect(stateOf()).toBe('none');
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(setup.reload).not.toHaveBeenCalled();
    hide();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    setup.controllerChanges();
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload if he came back before the new worker took control', async () => {
    const setup = fakeSetup();
    start(setup, async () => false);
    await settle();
    setup.newWorkerWaits();
    await settle();
    hide();
    visibility = 'visible';
    setup.controllerChanges();
    expect(setup.reload).not.toHaveBeenCalled();
  });

  // mw-5r3p30.304: the page must not keep running the old build under the new worker until the next cold start
  it('took over while visible, reloads when next hidden', async () => {
    const setup = fakeSetup();
    start(setup, async () => false);
    await settle();
    setup.newWorkerWaits();
    await settle();
    hide();
    show();
    setup.controllerChanges();
    expect(setup.reload).not.toHaveBeenCalled();
    expect(stateOf()).toBe('none');
    show();
    expect(setup.reload).not.toHaveBeenCalled();
    hide();
    expect(setup.reload).toHaveBeenCalledTimes(1);
    show();
    hide();
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('is asked for again at the next hide when the app was hidden and visible at once and the worker did not take over', async () => {
    const setup = fakeSetup();
    start(setup, async () => false);
    await settle();
    const worker = setup.newWorkerWaits();
    await settle();
    hide();
    show();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(stateOf()).toBe('none');
    hide();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    setup.controllerChanges();
    expect(setup.reload).toHaveBeenCalledTimes(1);
  });

  it('is not asked for again once the worker has taken over', async () => {
    const setup = fakeSetup();
    start(setup, async () => false);
    await settle();
    const worker = setup.newWorkerWaits();
    await settle();
    hide();
    setup.controllerChanges();
    show();
    hide();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });
});

describe('a waiting build with something new to show, or an unreadable judge (Lampas: app-update-quiet)', () => {
  it('shows the banner and applies nothing without his tap', async () => {
    const worker = fakeWorker();
    const setup = fakeSetup({ waiting: worker });
    start(setup, async () => true);
    await settle();
    expect(stateOf()).toBe('ready');
    hide();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(setup.reload).not.toHaveBeenCalled();
  });
});
