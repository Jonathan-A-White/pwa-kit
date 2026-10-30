// The push subscription, with a fake PushManager, a fake permission and a fake backend: nothing here touches a network or a browser.
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORDS, PushError, createPush } from '../src/index.js';
import type { PushOptions, PushWords } from '../src/index.js';

const PUBLIC_KEY_HEX = '02' + 'ab'.repeat(32);
// 65 bytes of a P-256 point as base64url, as a backend's VAPID key is.
const VAPID = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

interface Call {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function fakeBackend(answers: Record<string, { status: number; body?: unknown }> = {}) {
  const calls: Call[] = [];
  const signer = {
    async fetch(path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
      const method = init?.method ?? 'GET';
      calls.push({ path, method, body: init?.body === undefined ? undefined : JSON.parse(init.body), headers: init?.headers ?? {} });
      const answer = answers[`${method} ${path}`] ?? { status: 200, body: {} };
      return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body };
    },
  };
  return { signer, calls };
}

function fakePushManager(initial: boolean) {
  const state = { held: initial, subscribeCalls: [] as unknown[], unsubscribed: 0, failSubscribe: false };
  const subscription = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: async () => {
      state.held = false;
      state.unsubscribed += 1;
      return true;
    },
  };
  const registration = {
    pushManager: {
      async subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) {
        if (state.failSubscribe) throw new Error('the push service said no');
        state.subscribeCalls.push(options);
        state.held = true;
        return subscription;
      },
      async getSubscription() {
        return state.held ? subscription : null;
      },
    },
  };
  return { state, registration };
}

function fakeNotification(permission: 'default' | 'granted' | 'denied', onAsk: 'granted' | 'denied' = 'granted') {
  const asked = { count: 0 };
  return {
    asked,
    notification: {
      permission,
      async requestPermission() {
        asked.count += 1;
        this.permission = onAsk;
        return onAsk;
      },
    },
  };
}

function setup(over: Partial<PushOptions> & { held?: boolean; permission?: 'default' | 'granted' | 'denied'; onAsk?: 'granted' | 'denied'; answers?: Record<string, { status: number; body?: unknown }> } = {}) {
  const backend = fakeBackend(over.answers);
  const manager = fakePushManager(over.held ?? false);
  const permission = fakeNotification(over.permission ?? 'default', over.onAsk ?? 'granted');
  const push = createPush({
    signer: backend.signer,
    publicKeyHex: PUBLIC_KEY_HEX,
    vapidPublicKey: VAPID,
    registration: async () => manager.registration,
    notification: permission.notification,
    supported: () => true,
    ...over,
  });
  return { push, ...backend, ...manager, ...permission };
}

describe('subscribe', () => {
  it('asks for permission, subscribes with the VAPID key and posts the subscription once, signed by the injected signer', async () => {
    const t = setup();
    const status = await t.push.subscribe();
    expect(t.asked.count).toBe(1);
    expect(t.state.subscribeCalls).toHaveLength(1);
    const options = t.state.subscribeCalls[0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array };
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(options.applicationServerKey).toHaveLength(65);
    expect(options.applicationServerKey[0]).toBe(0x04);
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]).toMatchObject({
      path: '/push/subscribe',
      method: 'POST',
      body: { pubkey: PUBLIC_KEY_HEX, subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } },
    });
    expect(t.calls[0]?.headers['Content-Type']).toBe('application/json');
    expect(status).toEqual({ state: 'on', line: DEFAULT_WORDS.on });
  });

  it('reads the VAPID key from the backend through the signer when the app gives none', async () => {
    const t = setup({ vapidPublicKey: undefined, answers: { 'GET /push/vapid-public-key': { status: 200, body: { publicKey: VAPID } } } });
    await t.push.subscribe();
    expect(t.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /push/vapid-public-key', 'POST /push/subscribe']);
    expect((t.state.subscribeCalls[0] as { applicationServerKey: Uint8Array }).applicationServerKey).toHaveLength(65);
  });

  it('does not ask again when permission is already granted', async () => {
    const t = setup({ permission: 'granted' });
    await t.push.subscribe();
    expect(t.asked.count).toBe(0);
    expect(t.calls).toHaveLength(1);
  });

  it('answers a denied permission with a status holding the one plain line, and posts nothing', async () => {
    const t = setup({ onAsk: 'denied' });
    const status = await t.push.subscribe();
    expect(status).toEqual({ state: 'denied', line: DEFAULT_WORDS.denied });
    expect(DEFAULT_WORDS.denied).toMatch(/blocked/i);
    expect(t.calls).toEqual([]);
    expect(t.state.subscribeCalls).toEqual([]);
  });

  it('does not ask again when the phone already says denied', async () => {
    const t = setup({ permission: 'denied' });
    const status = await t.push.subscribe();
    expect(status.state).toBe('denied');
    expect(t.asked.count).toBe(0);
  });

  it('says what an unsupported phone needs, and does nothing', async () => {
    const t = setup({ supported: () => false });
    const status = await t.push.subscribe();
    expect(status).toEqual({ state: 'unsupported', line: DEFAULT_WORDS.unsupported });
    expect(t.asked.count).toBe(0);
    expect(t.calls).toEqual([]);
  });

  it('throws a PushError with a plain line when the backend refuses, and undoes the browser subscription it just made', async () => {
    const t = setup({ answers: { 'POST /push/subscribe': { status: 500 } } });
    const err = await t.push.subscribe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PushError);
    expect((err as PushError).message).toBe(DEFAULT_WORDS.backendFailed);
    expect((err as PushError).status).toBe(500);
    expect(t.state.held).toBe(false);
  });

  it('throws a PushError when the push service refuses the subscription', async () => {
    const t = setup();
    t.state.failSubscribe = true;
    const err = await t.push.subscribe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PushError);
    expect((err as PushError).message).toBe(DEFAULT_WORDS.subscribeFailed);
    expect(t.calls).toEqual([]);
  });

  it('throws a PushError when the backend cannot give its VAPID key', async () => {
    const t = setup({ vapidPublicKey: undefined, answers: { 'GET /push/vapid-public-key': { status: 503 } } });
    const err = await t.push.subscribe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PushError);
    expect((err as PushError).message).toBe(DEFAULT_WORDS.backendFailed);
  });
});

describe('status', () => {
  it("reads 'on' once subscribed, with the plain line", async () => {
    const t = setup();
    expect((await t.push.status()).state).toBe('off');
    await t.push.subscribe();
    expect(await t.push.status()).toEqual({ state: 'on', line: DEFAULT_WORDS.on });
  });

  it("reads 'on' on a later visit from the browser's own subscription, not from memory", async () => {
    const t = setup({ held: true, permission: 'granted' });
    expect((await t.push.status()).state).toBe('on');
  });

  it("reads 'off' when permission is not asked yet, with an invitation as its line", async () => {
    const t = setup();
    expect(await t.push.status()).toEqual({ state: 'off', line: DEFAULT_WORDS.off });
    expect(t.asked.count).toBe(0);
  });

  it("reads 'denied' with the one plain line when the phone has blocked notifications", async () => {
    const t = setup({ permission: 'denied' });
    expect(await t.push.status()).toEqual({ state: 'denied', line: DEFAULT_WORDS.denied });
  });

  it("reads 'unsupported' when the phone cannot do push", async () => {
    const t = setup({ supported: () => false });
    expect(await t.push.status()).toEqual({ state: 'unsupported', line: DEFAULT_WORDS.unsupported });
  });

  it("reads 'off' when the registration cannot be had", async () => {
    const t = setup({ permission: 'granted', registration: async () => { throw new Error('no worker'); } });
    expect((await t.push.status()).state).toBe('off');
  });
});

describe('unsubscribe', () => {
  it('cancels the browser subscription and posts the removal, and status reads off', async () => {
    const t = setup();
    await t.push.subscribe();
    t.calls.length = 0;
    const status = await t.push.unsubscribe();
    expect(t.state.unsubscribed).toBe(1);
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]).toMatchObject({ path: '/push/unsubscribe', method: 'POST', body: { pubkey: PUBLIC_KEY_HEX, endpoint: 'https://push.example/abc' } });
    expect(status).toEqual({ state: 'off', line: DEFAULT_WORDS.off });
    expect((await t.push.status()).state).toBe('off');
  });

  it('still takes the subscription down when the backend refuses the removal (a push to a dead endpoint is dropped by the backend)', async () => {
    const t = setup({ answers: { 'POST /push/unsubscribe': { status: 404 } } });
    await t.push.subscribe();
    const status = await t.push.unsubscribe();
    expect(status.state).toBe('off');
    expect(t.state.held).toBe(false);
  });

  it('posts nothing when the app says its backend has no removal call', async () => {
    const t = setup({ paths: { unsubscribe: null } });
    await t.push.subscribe();
    t.calls.length = 0;
    await t.push.unsubscribe();
    expect(t.calls).toEqual([]);
    expect(t.state.unsubscribed).toBe(1);
  });

  it('does nothing when there is no subscription', async () => {
    const t = setup();
    const status = await t.push.unsubscribe();
    expect(status.state).toBe('off');
    expect(t.calls).toEqual([]);
  });
});

describe('words', () => {
  it('the app can replace any of the words', async () => {
    const words: Partial<PushWords> = { denied: 'Notifications are blocked. Open Settings, then Safari, then Notifications.' };
    const t = setup({ permission: 'denied', words });
    expect(await t.push.status()).toEqual({ state: 'denied', line: words.denied });
    expect(t.push.words.on).toBe(DEFAULT_WORDS.on);
  });

  it('every default word is one plain sentence or label, and the unsupported line names the iPhone Home Screen need', () => {
    for (const [name, text] of Object.entries(DEFAULT_WORDS)) {
      expect(text.length, name).toBeGreaterThan(0);
      expect(text, name).not.toMatch(/\n/);
    }
    expect(DEFAULT_WORDS.unsupported).toMatch(/Home Screen/);
    expect(DEFAULT_WORDS.unsupported).toMatch(/16\.4/);
  });
});
