// A request to the maker, filed from a talk with the tutor: the words, who asked, kept once a day, under a budget. Never a form.
// Sending, storage and the clock are the app's: passed in to createRequests.
import { DEFAULT_PER_DAY, budgetMessage, budgetOf, type Budget } from './budget.js';
import { applyUpdates, isFinal, type RequestRecord, type StatusReader } from './status.js';

/** Who asked when a grown-up did, rather than a learner. A learner is their own id. */
export const GROWN_UP = 'grown-up';

/** The most words one request holds: as long as a question to the tutor may be. */
export const MAX_WORDS = 4000;
/** The most a summary may be. */
export const MAX_SUMMARY = 200;

/** What the app's sender is given: the shape of a tutor-ask request, with who asked. The app maps it to its own wire. */
export interface MakerRequest {
  kind: string;
  /** What was asked, in the person's words, trimmed. */
  text: string;
  /** The tutor's one-line summary, or the start of the words. */
  summary: string;
  /** The talk it was filed from. */
  reference: string;
  who: string;
  app_version: string;
}

/** The sender the app injects: sends the request and answers the id the maker's side knows it by (a status update names it). It throws when it cannot. */
export type MakerSender = (request: MakerRequest) => Promise<{ id: string }>;

/** The requests kept. `all` may answer in any order; `put` adds a record or, with the same id, replaces it. */
export interface RequestStore {
  all(): readonly RequestRecord[] | Promise<readonly RequestRecord[]>;
  put(record: RequestRecord): void | Promise<void>;
}

/** The browser's own key-value store, or any pair like it. */
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export const DEFAULT_KEY = 'pwa-kit:requests';

/** A RequestStore over a key-value storage, the records kept as one JSON list. Data that is not a list counts as nothing kept. */
export function createJsonStore(storage: KeyValueStorage, key: string = DEFAULT_KEY): RequestStore {
  const load = async (): Promise<RequestRecord[]> => {
    const raw = await storage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((r): r is RequestRecord => typeof r === 'object' && r !== null && typeof (r as RequestRecord).id === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    all: load,
    async put(record) {
      const rows = await load();
      const at = rows.findIndex((r) => r.id === record.id);
      if (at >= 0) rows[at] = record;
      else rows.push(record);
      await storage.setItem(key, JSON.stringify(rows));
    },
  };
}

/** What a talk hands over to be filed. */
export interface TalkAsk {
  /** The talk it comes from. */
  talkId: string;
  /** What was asked, in the person's words. */
  words: string;
  /** Who asked: a learner id, or GROWN_UP. */
  who: string;
  /** The kind of ask, the app's own word. */
  kind: string;
  /** The tutor's one-line summary; the start of the words when it gives none. */
  summary?: string;
  /** The expected ask (see expected.ts) this answers, so the settings row can show where it stands. */
  askId?: string;
}

/** How a filing ended. A send that failed is not an outcome: it throws, and nothing is kept. */
export type FileResult =
  | { outcome: 'sent'; record: RequestRecord }
  /** The same words were already filed today by the same person: the request kept is answered, nothing is sent. */
  | { outcome: 'duplicate'; record: RequestRecord }
  | { outcome: 'refused'; reason: 'budget' | 'empty' | 'too-long'; message: string };

export interface RequestsOptions {
  send: MakerSender;
  store: RequestStore;
  /** The app's version, sent as app_version. */
  appVersion: string;
  /** Requests a day, all people together. DEFAULT_PER_DAY by default. */
  perDay?: number;
  /** Reads the status of the open requests; without one, refresh() changes nothing. */
  readStatuses?: StatusReader;
  /** The clock, in ms; the wall clock by default. Tests pass their own. */
  now?: () => number;
}

export interface Requests {
  /** Files what a talk asks for: one request, unless the same person filed the same words today or the budget is spent. */
  fileFromTalk(ask: TalkAsk): Promise<FileResult>;
  /** Every request kept, the newest first. */
  list(): Promise<RequestRecord[]>;
  /** Today's budget. */
  budget(): Promise<Budget>;
  /** Asks the reader about the open requests and keeps what it says. Rejects when the reader does. */
  refresh(): Promise<{ changed: number }>;
}

/** The person's own calendar day of `ms` as YYYY-MM-DD: the local day, never the UTC day. */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Words as compared for "the same": capitals and the spaces between words do not count. */
const sameness = (words: string): string => words.trim().replace(/\s+/g, ' ').toLowerCase();

function summaryOf(words: string, given: string | undefined): string {
  const text = (given ?? '').trim() || words;
  return text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1).trimEnd()}…`;
}

export function createRequests(options: RequestsOptions): Requests {
  const { send, store, appVersion } = options;
  const perDay = options.perDay ?? DEFAULT_PER_DAY;
  const now = options.now ?? ((): number => Date.now());
  if (!Number.isInteger(perDay) || perDay < 1) throw new RangeError('perDay is a whole number, 1 or more');

  const list = async (): Promise<RequestRecord[]> =>
    [...(await store.all())].sort((a, b) => b.sentAt - a.sentAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  async function file(ask: TalkAsk): Promise<FileResult> {
    const words = ask.words.trim();
    if (words === '') return { outcome: 'refused', reason: 'empty', message: 'Say what you would like first.' };
    if (words.length > MAX_WORDS) return { outcome: 'refused', reason: 'too-long', message: `That is longer than ${MAX_WORDS} characters. Say it a little shorter.` };
    const sentAt = now();
    const day = dayOf(sentAt);
    const records = await store.all();
    const same = sameness(words);
    const twin = records.find((r) => r.day === day && r.who === ask.who && r.kind === ask.kind && sameness(r.words) === same);
    if (twin) return { outcome: 'duplicate', record: twin };
    const budget = budgetOf(records, day, perDay);
    if (budget.left === 0) return { outcome: 'refused', reason: 'budget', message: budgetMessage(perDay) };
    const summary = summaryOf(words, ask.summary);
    const { id } = await send({ kind: ask.kind, text: words, summary, reference: ask.talkId, who: ask.who, app_version: appVersion });
    const record: RequestRecord = { id, kind: ask.kind, words, summary, talkId: ask.talkId, who: ask.who, sentAt, day, status: 'sent' };
    if (ask.askId !== undefined) record.askId = ask.askId;
    await store.put(record);
    return { outcome: 'sent', record };
  }

  // One filing at a time, so two taps at once see each other: the second finds the first's request, and the budget counts both.
  let tail: Promise<unknown> = Promise.resolve();

  return {
    fileFromTalk(ask) {
      const run = tail.then(() => file(ask));
      tail = run.catch(() => undefined);
      return run;
    },
    list,
    async budget() {
      return budgetOf(await store.all(), dayOf(now()), perDay);
    },
    async refresh() {
      if (!options.readStatuses) return { changed: 0 };
      const records = await store.all();
      const open = records.filter((r) => !isFinal(r));
      const updates = await options.readStatuses(open);
      const { records: next, changed } = applyUpdates(records, updates);
      for (const id of changed) {
        const record = next.find((r) => r.id === id);
        if (record) await store.put(record);
      }
      return { changed: changed.length };
    },
  };
}
