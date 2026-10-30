// The outgoing queue, lifted from Postern's outbox (and the smaller twin in Trade Tracker's lookup runner): every write is put in the
// app's Dexie table first and the caller goes on at once; one sender takes the waiting items in the order they were queued, one at a
// time, each with a time limit, and tries a failed one again after a growing wait. It sends only while the page is online and in front
// of the user. A client id is made when the write is queued and goes with every try, so the receiver can store a retried write once;
// the sender MUST be idempotent on it. What the app's backend is, and how a write is signed, is the sender's business.
import { browserPage } from './page.js';
import type { OutboxPage } from './page.js';
import { DEFAULT_WORDS, itemStatus, queueStatus } from './status.js';
import type { ItemStatus, OutboxItem, OutboxStatus, OutboxWords } from './status.js';

/** The part of a Dexie table the outbox uses, keyed by `clientId` (`outbox: 'clientId, queuedAt'`). A Dexie `Table<OutboxItem<P>, string>` fits as it is. */
export interface OutboxTable<P = unknown> {
  get(clientId: string): Promise<OutboxItem<P> | undefined>;
  add(item: OutboxItem<P>): Promise<unknown>;
  put(item: OutboxItem<P>): Promise<unknown>;
  delete(clientId: string): Promise<void>;
  toArray(): Promise<OutboxItem<P>[]>;
}

/** What a sender is given besides the item. */
export interface SendContext {
  /** Aborted when the send outruns `timeoutMs`, or the outbox is stopped. A sender that passes it to `fetch` stops the request. */
  signal: AbortSignal;
}

/**
 * Sends one item. Resolve when the receiver has it; throw when it has not. It may be called again for the same `item.clientId`
 * (a timeout, a reload in the middle of a send, a retry), so it MUST be idempotent on the client id: send it with the request and
 * let the receiver store a repeat once.
 */
export type OutboxSender<P> = (item: OutboxItem<P>, context: SendContext) => Promise<unknown>;

/** Throw this from a sender for a write that can never go (a 4xx other than 408 and 429): the item becomes `failed` with this message as its reason, waits for Retry or Discard, and the items behind it go on. */
export class PermanentSendError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PermanentSendError';
  }
}

/** The reason a send that ran out of time is given. */
export class SendTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendTimeoutError';
  }
}

export interface OutboxOptions<P> {
  table: OutboxTable<P>;
  sender: OutboxSender<P>;
  /** Told the queue's status whenever it changes, for the screen's label. */
  onStatus?: (status: OutboxStatus) => void;
  /** The longest one send may run. Default 30 s. */
  timeoutMs?: number;
  /** The wait after a failed try: `baseMs` after the first, doubling, to `maxMs`. Default 1 s to 5 min. */
  backoff?: { baseMs?: number; maxMs?: number };
  /** How long a sent item stays in the table (and shows as Sent) before it is forgotten. Default one minute. */
  keepSentMs?: number;
  /** Whether a thrown error is final. Default: it is a `PermanentSendError`. */
  isPermanent?: (err: unknown) => boolean;
  /** The reason an error is kept under, shown to the user. Default: the error's message. */
  reasonOf?: (err: unknown) => string;
  /** The page's online and visible state and its changes. Default: the browser's. */
  page?: OutboxPage;
  /** Replaces any of the default words. */
  words?: Partial<OutboxWords>;
  /** Makes a client id. Default: `crypto.randomUUID()`. */
  newId?: () => string;
  /** Told of a problem the outbox itself had (the table could not be read). Default: `console.warn`. */
  onError?: (err: unknown) => void;
}

export interface Outbox<P> {
  /** Writes the item to the table first, and resolves with it once it is written, not once it is sent. With a `clientId` already in the table, resolves with the item that is there, untouched. */
  enqueue(payload: P, options?: { clientId?: string }): Promise<OutboxItem<P>>;
  /** Starts sending: an item left `sending` by a closed page goes back to waiting, and the waiting ones are tried now. Answers the call that stops it. */
  start(): () => void;
  /** A `failed` item goes back in the queue in its old place and is tried at once. */
  retry(clientId: string): Promise<void>;
  /** A `failed` (or any) item is forgotten. */
  discard(clientId: string): Promise<void>;
  /** Looks at the queue now; `force` skips the waits that failed items set themselves (the network is back). */
  kick(force?: boolean): void;
  /** The queue's status now. */
  status(): Promise<OutboxStatus>;
  /** What one item stands at, in words. */
  itemStatus(item: OutboxItem<P>): ItemStatus;
  /** Resolves once the sender has gone quiet (a test's seam; an app never waits on it). */
  settled(): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_BACKOFF = { baseMs: 1_000, maxMs: 5 * 60_000 };
const DEFAULT_KEEP_SENT_MS = 60_000;

function randomId(): string {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function defaultReason(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}

/** The wait after the `attempts`th failed try. */
export function backoffMs(attempts: number, baseMs = DEFAULT_BACKOFF.baseMs, maxMs = DEFAULT_BACKOFF.maxMs): number {
  return Math.min(baseMs * 2 ** Math.max(0, attempts - 1), maxMs);
}

/** Sets up an outbox over the app's table and sender. Nothing is sent until `start()`; `enqueue` writes the table before that, so nothing is lost. */
export function createOutbox<P>(options: OutboxOptions<P>): Outbox<P> {
  const { table, sender, onStatus } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseMs = options.backoff?.baseMs ?? DEFAULT_BACKOFF.baseMs;
  const maxMs = options.backoff?.maxMs ?? DEFAULT_BACKOFF.maxMs;
  const keepSentMs = options.keepSentMs ?? DEFAULT_KEEP_SENT_MS;
  const isPermanent = options.isPermanent ?? ((err: unknown) => err instanceof PermanentSendError);
  const reasonOf = options.reasonOf ?? defaultReason;
  const page = options.page ?? browserPage();
  const words: OutboxWords = { ...DEFAULT_WORDS, ...options.words };
  const newId = options.newId ?? randomId;
  const onError = options.onError ?? ((err: unknown) => console.warn('The outbox could not be read:', err));

  /** Bumped by stop(): a pass or a send that started before it writes nothing more. */
  let generation = 0;
  let started = false;
  /** Set by start(): the first pass puts back what a closed page left `sending`. */
  let recovering = false;
  let stopPage: (() => void) | undefined;
  let draining: Promise<void> | undefined;
  let again: { force: boolean } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let lastQueuedAt: number | undefined;
  let emitting: Promise<void> = Promise.resolve();
  let lastEmitted = '';

  const ready = (): boolean => page.isOnline() && page.isVisible();

  async function status(): Promise<OutboxStatus> {
    return queueStatus(await table.toArray(), page.isOnline(), words);
  }

  /** Tells onStatus the status if it is not what it last told; one at a time, each read fresh, so the told order is the true order. */
  function emit(): Promise<void> {
    if (!onStatus) return Promise.resolve();
    emitting = emitting.then(async () => {
      const next = await status();
      const key = JSON.stringify(next);
      if (key === lastEmitted) return;
      lastEmitted = key;
      onStatus(next);
    }).catch(onError);
    return emitting;
  }

  /** Items are sent in the order they were queued; two queued in the same millisecond keep their order. */
  async function nextQueuedAt(): Promise<number> {
    if (lastQueuedAt === undefined) lastQueuedAt = Math.max(0, ...(await table.toArray()).map((i) => i.queuedAt));
    lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
    return lastQueuedAt;
  }

  /** The item as it was, with some fields changed and others taken away. */
  function changed(item: OutboxItem<P>, change: Partial<OutboxItem<P>>, drop: ReadonlyArray<'nextAt' | 'reason' | 'sentAt'> = []): OutboxItem<P> {
    const next = { ...item, ...change };
    for (const key of drop) delete next[key];
    return next;
  }

  function timeoutAfter(ms: number, work: Promise<unknown>, run: AbortController): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const seconds = Math.round((ms / 1000) * 10) / 10;
      const clock = setTimeout(() => {
        run.abort();
        reject(new SendTimeoutError(words.timedOut(seconds)));
      }, ms);
      work.then(
        () => {
          clearTimeout(clock);
          resolve();
        },
        (err: unknown) => {
          clearTimeout(clock);
          reject(err);
        },
      );
    });
  }

  function wakeAt(at: number): void {
    clearTimeout(timer);
    timer = setTimeout(() => kick(false), Math.max(0, at - Date.now()));
  }

  async function drain(force: boolean): Promise<void> {
    const mine = generation;
    clearTimeout(timer);
    timer = undefined;
    let lookAt: number | undefined;
    const look = (at: number): void => {
      lookAt = lookAt === undefined ? at : Math.min(lookAt, at);
    };

    // the page may have been closed in the middle of a send: whether it landed is not known, so it is sent again, by its client id
    if (recovering) {
      recovering = false;
      for (const item of await table.toArray()) {
        if (mine !== generation) return;
        if (item.stage === 'sending') await table.put(changed(item, { stage: 'waiting' }));
      }
    }

    // sent items are forgotten after a while; nothing can queue them again
    for (const item of await table.toArray()) {
      if (item.stage !== 'sent') continue;
      const forgetAt = (item.sentAt ?? item.queuedAt) + keepSentMs;
      if (forgetAt <= Date.now()) await table.delete(item.clientId);
      else look(forgetAt);
    }

    const waiting = (await table.toArray()).filter((i) => i.stage === 'waiting').sort((a, b) => a.queuedAt - b.queuedAt);
    for (const item of waiting) {
      if (mine !== generation || !ready()) break;
      if (!force && item.nextAt !== undefined && item.nextAt > Date.now()) {
        // a passing failure holds the items behind it, so they go in the order they were queued
        look(item.nextAt);
        break;
      }
      const sending = changed(item, { stage: 'sending' }, ['nextAt']);
      await table.put(sending);
      await emit();
      const run = new AbortController();
      controller = run;
      try {
        await timeoutAfter(timeoutMs, sender(sending, { signal: run.signal }), run);
      } catch (err) {
        if (mine !== generation) return;
        const attempts = item.attempts + 1;
        const reason = reasonOf(err);
        if (isPermanent(err)) {
          await table.put(changed(item, { stage: 'failed', attempts, reason }, ['nextAt']));
          continue;
        }
        const nextAt = Date.now() + backoffMs(attempts, baseMs, maxMs);
        await table.put(changed(item, { stage: 'waiting', attempts, reason, nextAt }));
        look(nextAt);
        break;
      } finally {
        if (controller === run) controller = undefined;
      }
      if (mine !== generation) return;
      const sentAt = Date.now();
      await table.put(changed(item, { stage: 'sent', attempts: item.attempts + 1, sentAt }, ['nextAt', 'reason']));
      look(sentAt + keepSentMs);
      await emit();
    }
    await emit();
    if (lookAt !== undefined && mine === generation && started) wakeAt(lookAt);
  }

  function kick(force = false): void {
    if (!started) return;
    if (draining) {
      again = { force: force || (again?.force ?? false) };
      return;
    }
    const run = drain(force)
      .catch(onError)
      .finally(() => {
        if (draining === run) draining = undefined;
        const next = again;
        again = undefined;
        if (next) kick(next.force);
      });
    draining = run;
  }

  return {
    async enqueue(payload, enqueueOptions = {}) {
      const clientId = enqueueOptions.clientId ?? newId();
      const there = await table.get(clientId);
      if (there) return there;
      const item: OutboxItem<P> = { clientId, payload, stage: 'waiting', queuedAt: await nextQueuedAt(), attempts: 0 };
      await table.add(item);
      kick(false);
      await emit();
      return item;
    },

    start() {
      if (started) return stop;
      started = true;
      recovering = true;
      kick(false);
      stopPage = page.subscribe(() => kick(page.isOnline() && page.isVisible()));
      return stop;
    },

    async retry(clientId) {
      const item = await table.get(clientId);
      if (!item || item.stage !== 'failed') return;
      await table.put(changed(item, { stage: 'waiting', attempts: 0 }, ['reason', 'nextAt']));
      kick(true);
      await emit();
    },

    async discard(clientId) {
      await table.delete(clientId);
      kick(true);
      await emit();
    },

    kick,
    status,
    itemStatus: (item) => itemStatus(item, page.isOnline(), words),

    async settled() {
      while (draining) await draining;
    },
  };

  function stop(): void {
    if (!started) return;
    started = false;
    generation++;
    clearTimeout(timer);
    timer = undefined;
    again = undefined;
    stopPage?.();
    stopPage = undefined;
    controller?.abort();
  }
}
