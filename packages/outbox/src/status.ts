// The rows the outbox keeps, and the honest words for the screen: what each item stands at, and the one line for the whole queue.

/** Where one write stands. `failed` is final until the user retries or discards it; every other trouble leaves the item `waiting`. */
export type OutboxStage = 'waiting' | 'sending' | 'sent' | 'failed';

/** One write in the app's Dexie table, keyed by `clientId`. */
export interface OutboxItem<P = unknown> {
  /** The write's id, made when it was queued and sent with every try, so the receiver can store a retried write once. The table's primary key. */
  clientId: string;
  /** What the app wants sent; the sender receives the whole item. */
  payload: P;
  stage: OutboxStage;
  /** When it was queued (ms); the order they are sent in. */
  queuedAt: number;
  /** How many tries have ended, in a failure or a success. */
  attempts: number;
  /** While `waiting` after a passing failure: not before this time (ms). */
  nextAt?: number;
  /** Why the last try failed: the reason for a `failed` item, the passing trouble for a `waiting` one. Cleared when it is sent. */
  reason?: string;
  /** When it was sent (ms). */
  sentAt?: number;
}

/** The words the screen shows. Replace any of them with `words` in the options. */
export interface OutboxWords {
  /** A write waits and the phone is offline. */
  waitingForNetwork: string;
  /** A write waits for its turn, or the page is hidden. */
  waiting: string;
  sending: string;
  sent: string;
  /** A try failed for a passing reason, and the item will go again. */
  willRetry(reason: string): string;
  /** A write was refused for good. */
  failed(reason: string): string;
  /** The reason given for a send that outran its time. */
  timedOut(seconds: number): string;
}

export const DEFAULT_WORDS: OutboxWords = {
  waitingForNetwork: 'Waiting for the network',
  waiting: 'Waiting to send',
  sending: 'Sending',
  sent: 'Sent',
  willRetry: (reason) => `Will try again: ${reason}`,
  failed: (reason) => `Could not send: ${reason}`,
  timedOut: (seconds) => `The send did not finish in ${seconds} s.`,
};

/** What one item shows. */
export interface ItemStatus {
  state: OutboxStage;
  line: string;
}

/** What the whole queue shows: `line` is the one label for the screen, empty when there is nothing queued. */
export interface OutboxStatus {
  state: 'idle' | OutboxStage;
  line: string;
  waiting: number;
  sending: number;
  sent: number;
  failed: number;
  /** The reason on the line, for a `failed` queue or a `waiting` one that is trying again. */
  reason?: string;
}

/** What one item stands at, in words. A waiting item on an offline phone says so, whatever its last try said. */
export function itemStatus(item: OutboxItem, online: boolean, words: OutboxWords = DEFAULT_WORDS): ItemStatus {
  switch (item.stage) {
    case 'failed':
      return { state: 'failed', line: words.failed(item.reason ?? '') };
    case 'sending':
      return { state: 'sending', line: words.sending };
    case 'sent':
      return { state: 'sent', line: words.sent };
    case 'waiting':
      if (!online) return { state: 'waiting', line: words.waitingForNetwork };
      return { state: 'waiting', line: item.reason ? words.willRetry(item.reason) : words.waiting };
  }
}

/** The queue's one status: a failure first (it needs the user), then a send in progress, then a wait, then Sent, else nothing. */
export function queueStatus(items: readonly OutboxItem[], online: boolean, words: OutboxWords = DEFAULT_WORDS): OutboxStatus {
  const ordered = [...items].sort((a, b) => a.queuedAt - b.queuedAt);
  const of = (stage: OutboxStage): OutboxItem[] => ordered.filter((i) => i.stage === stage);
  const counts = { waiting: of('waiting').length, sending: of('sending').length, sent: of('sent').length, failed: of('failed').length };
  for (const stage of ['failed', 'sending', 'waiting', 'sent'] as const) {
    const first = of(stage)[0];
    if (!first) continue;
    const shown = itemStatus(first, online, words);
    const reason = stage === 'failed' || (stage === 'waiting' && online) ? first.reason : undefined;
    return { state: stage, line: shown.line, ...counts, ...(reason ? { reason } : {}) };
  }
  return { state: 'idle', line: '', ...counts };
}
