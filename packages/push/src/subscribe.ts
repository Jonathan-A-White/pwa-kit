// Notify me on a phone, lifted from Postern's src/services/push.ts. The permission is asked, the browser's push manager subscribes with the
// backend's VAPID public key, and the subscription is posted to the backend through a signer the app injects (bsv-kit's Door fits as it is).
// The backend, the key and the service worker are the app's, so every one of them comes in as an argument, and nothing here reads a global
// but the phone's own Notification and push support, when the app gives no stand-in.
import { DEFAULT_WORDS } from './words.js';
import type { PushWords } from './words.js';

/** The part of a signed fetch the kit uses: a path below the backend's /api, as bsv-kit's `Door.fetch` takes it, signed by the app's key. */
export interface PushSigner {
  fetch(path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

/** The part of a PushSubscription the kit uses. */
export interface SubscriptionLike {
  endpoint?: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

/** The part of a ServiceWorkerRegistration the kit uses. An app with a push-only registration for another account passes that one. */
export interface RegistrationLike {
  pushManager: {
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<SubscriptionLike>;
    getSubscription(): Promise<SubscriptionLike | null>;
  };
}

/** The part of the browser's Notification the kit uses. */
export interface NotificationLike {
  readonly permission: string;
  requestPermission(): Promise<string>;
}

export interface PushPaths {
  /** Where the subscription is posted. Default '/push/subscribe'. */
  subscribe?: string;
  /** Where the removal is posted; null for a backend with no such call (it then drops a dead endpoint when a push to it fails). Default '/push/unsubscribe'. */
  unsubscribe?: string | null;
  /** Where the VAPID public key is read when the app gives none. Default '/push/vapid-public-key'. */
  vapidPublicKey?: string;
}

export interface PushOptions {
  /** Signs each call to the backend with the app's key. */
  signer: PushSigner;
  /** The recipient public key (hex) the pushes are for, sent with the subscription. */
  publicKeyHex: string;
  /** The backend's VAPID public key (base64url). When omitted it is read once from the backend through the signer. */
  vapidPublicKey?: string;
  /** The service worker registration to subscribe on; defaults to `navigator.serviceWorker.ready`. */
  registration?: () => Promise<RegistrationLike>;
  /** The browser's Notification; defaults to the global one. */
  notification?: NotificationLike;
  /** Whether this phone and browser can do push at all; defaults to a check of the service worker, PushManager and Notification. */
  supported?: () => boolean;
  paths?: PushPaths;
  /** Replaces any of the default words. */
  words?: Partial<PushWords>;
}

export type PushState = 'on' | 'off' | 'denied' | 'unsupported';

/** Where notifications stand, and the one plain line to show for it. */
export interface PushStatus {
  state: PushState;
  line: string;
}

/** Notifications could not be set up; `message` is a plain line fit to show, `status` the backend's HTTP status when it was the backend. */
export class PushError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PushError';
    if (status !== undefined) this.status = status;
  }
}

export interface Push {
  /** Asks for permission if it has not been asked, subscribes, and posts the subscription once. A denied permission or an unsupported phone is a status, not an error; a refusal by the push service or the backend throws a PushError. */
  subscribe(): Promise<PushStatus>;
  /** Cancels this phone's subscription and posts the removal. A refused removal does not undo the cancel. */
  unsubscribe(): Promise<PushStatus>;
  /** Where notifications stand now, read from the phone and not from memory. */
  status(): Promise<PushStatus>;
  /** The words in use. */
  words: PushWords;
}

/** A base64url string (a VAPID public key) as the bytes `applicationServerKey` takes. */
export function urlBase64ToBytes(base64Url: string): Uint8Array {
  const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

interface Globals {
  navigator?: { serviceWorker?: { ready: Promise<RegistrationLike> } };
  window?: Record<string, unknown>;
  Notification?: NotificationLike;
}

function globals(): Globals {
  return globalThis as unknown as Globals;
}

function browserSupports(): boolean {
  const g = globals();
  return g.navigator?.serviceWorker !== undefined && g.window !== undefined && 'PushManager' in g.window && g.Notification !== undefined;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function createPush(options: PushOptions): Push {
  const words: PushWords = { ...DEFAULT_WORDS, ...options.words };
  const paths = {
    subscribe: options.paths?.subscribe ?? '/push/subscribe',
    unsubscribe: options.paths?.unsubscribe === undefined ? '/push/unsubscribe' : options.paths.unsubscribe,
    vapidPublicKey: options.paths?.vapidPublicKey ?? '/push/vapid-public-key',
  };
  const supported = options.supported ?? browserSupports;
  const notification = (): NotificationLike | undefined => options.notification ?? globals().Notification;
  const registration = options.registration ?? ((): Promise<RegistrationLike> => {
    const worker = globals().navigator?.serviceWorker;
    return worker ? worker.ready : Promise.reject(new Error('no service worker'));
  });
  let vapid = options.vapidPublicKey;

  const at = (state: PushState, line: string): PushStatus => ({ state, line });
  const unsupported = (): PushStatus => at('unsupported', words.unsupported);
  const denied = (): PushStatus => at('denied', words.denied);
  const on = (): PushStatus => at('on', words.on);
  const off = (): PushStatus => at('off', words.off);

  async function vapidKey(): Promise<string> {
    if (vapid !== undefined) return vapid;
    const response = await options.signer.fetch(paths.vapidPublicKey);
    if (!response.ok) throw new PushError(words.backendFailed, response.status);
    const body = (await response.json()) as { publicKey?: unknown };
    if (typeof body.publicKey !== 'string' || body.publicKey === '') throw new PushError(words.backendFailed, response.status);
    vapid = body.publicKey;
    return vapid;
  }

  async function status(): Promise<PushStatus> {
    if (!supported()) return unsupported();
    const permission = notification()?.permission;
    if (permission === 'denied') return denied();
    if (permission !== 'granted') return off();
    try {
      return (await (await registration()).pushManager.getSubscription()) ? on() : off();
    } catch {
      return off();
    }
  }

  async function subscribe(): Promise<PushStatus> {
    if (!supported()) return unsupported();
    const asker = notification();
    if (!asker) return unsupported();
    if (asker.permission === 'denied') return denied();
    if (asker.permission !== 'granted') {
      const answer = await asker.requestPermission();
      if (answer === 'denied') return denied();
      if (answer !== 'granted') return off(); // the prompt was dismissed: nothing was decided, so it may be asked again
    }
    const key = await vapidKey();
    let subscription: SubscriptionLike;
    try {
      subscription = await (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(key) });
    } catch {
      throw new PushError(words.subscribeFailed);
    }
    const response = await options.signer.fetch(paths.subscribe, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ pubkey: options.publicKeyHex, subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
      // A subscription the backend does not know would show as On with nothing ever arriving: take it back down.
      await subscription.unsubscribe().catch(() => false);
      throw new PushError(words.backendFailed, response.status);
    }
    return on();
  }

  async function unsubscribe(): Promise<PushStatus> {
    if (!supported()) return unsupported();
    let subscription: SubscriptionLike | null = null;
    try {
      subscription = await (await registration()).pushManager.getSubscription();
    } catch {
      return off();
    }
    if (!subscription) return off();
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    if (paths.unsubscribe !== null) {
      // The cancel above is what stops the pushes; a backend that cannot take the news drops the dead endpoint on its next push.
      try {
        await options.signer.fetch(paths.unsubscribe, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ pubkey: options.publicKeyHex, endpoint }),
        });
      } catch {
        /* the same: the cancel stands */
      }
    }
    return off();
  }

  return { subscribe, unsubscribe, status, words };
}
