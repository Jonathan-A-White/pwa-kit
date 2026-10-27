// The status of a request after it was sent, seen through a reader the app injects, and a loop that asks for it now and then.

/** Where a request stands. 'sent' is the first, kept when the maker's side has the request; the rest come back from the reader. */
export const REQUEST_STATUSES = ['sent', 'filed', 'building', 'landed', 'declined', 'adopted-as-setting', 'built-differently', 'moved'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** The statuses nothing follows: a request that reached one is not asked about again. 'moved' is not one: the request now follows another story. */
export const FINAL_STATUSES: readonly RequestStatus[] = ['landed', 'declined', 'adopted-as-setting', 'built-differently'];

/** A request kept: what was asked, who asked, and where it stands. */
export interface RequestRecord {
  /** The id the sender gave it, which the reader's updates name. */
  id: string;
  /** The kind of ask, the app's own word ('tutor-ask', 'setting', ...). */
  kind: string;
  /** The expected ask this came from, when it came from a row of the settings. */
  askId?: string | undefined;
  /** What was asked, in the person's words. */
  words: string;
  /** The tutor's one-line summary of the ask, or the start of the words. */
  summary: string;
  /** The talk it was filed from. */
  talkId: string;
  /** Who asked: a learner id, or GROWN_UP. */
  who: string;
  sentAt: number;
  /** The person's own calendar day of sentAt, YYYY-MM-DD. */
  day: string;
  status: RequestStatus;
  /** When the maker's side set the status, a number the reader gives; a newer one replaces an older. */
  statusAt?: number;
  bead?: string;
  /** landed, built-differently: the version it came in, and where to read the change. */
  version?: string;
  commit?: string;
  url?: string;
  /** declined: why. built-differently: the one-sentence note on how it was answered. moved: the title of the story it now follows (bead is that story). */
  reason?: string;
  /** adopted-as-setting: the setting's name. */
  setting?: string;
}

/** What the reader says of one request: only fields the status carries are kept. */
export interface StatusUpdate {
  /** The id of the request it is about. */
  request: string;
  status: Exclude<RequestStatus, 'sent'>;
  ts: number;
  bead?: string;
  version?: string;
  commit?: string;
  url?: string;
  reason?: string;
  setting?: string;
}

/** The reader the app injects: given the requests still open, the updates it has for them (it may keep its own cursor). Others are ignored. */
export type StatusReader = (open: readonly RequestRecord[]) => Promise<readonly StatusUpdate[]>;

export const isFinal = (record: RequestRecord): boolean => FINAL_STATUSES.includes(record.status);

/** The record after `update`: its asked fields, the new status and only what that status carries. */
export function moved(record: RequestRecord, update: StatusUpdate): RequestRecord {
  const next: RequestRecord = {
    id: record.id,
    kind: record.kind,
    words: record.words,
    summary: record.summary,
    talkId: record.talkId,
    who: record.who,
    sentAt: record.sentAt,
    day: record.day,
    status: update.status,
    statusAt: update.ts,
  };
  if (record.askId !== undefined) next.askId = record.askId;
  if (update.bead !== undefined) next.bead = update.bead;
  if (update.status === 'landed' || update.status === 'built-differently') {
    if (update.version !== undefined) next.version = update.version;
    if (update.commit !== undefined) next.commit = update.commit;
    if (update.url !== undefined) next.url = update.url;
  }
  if ((update.status === 'declined' || update.status === 'built-differently' || update.status === 'moved') && update.reason !== undefined) next.reason = update.reason;
  if (update.status === 'adopted-as-setting' && update.setting !== undefined) next.setting = update.setting;
  return next;
}

/** The records after `updates`, and the ids that changed. An update for a request not held, or no newer than the one the record took, changes nothing. */
export function applyUpdates(records: readonly RequestRecord[], updates: readonly StatusUpdate[]): { records: RequestRecord[]; changed: string[] } {
  const byId = new Map(records.map((r) => [r.id, r]));
  const changed = new Set<string>();
  for (const update of [...updates].sort((a, b) => a.ts - b.ts)) {
    const record = byId.get(update.request);
    if (!record) continue;
    if (record.statusAt !== undefined && update.ts <= record.statusAt) continue;
    byId.set(record.id, moved(record, update));
    changed.add(record.id);
  }
  return { records: [...byId.values()], changed: [...changed] };
}

/** The line that says where a request stands, as plain words. */
export function statusLine(record: RequestRecord): string {
  switch (record.status) {
    case 'filed':
      return 'Filed';
    case 'building':
      return 'Being built';
    case 'landed':
      return record.version ? `Adopted in ${record.version}` : 'Adopted';
    case 'declined':
      return record.reason ? `Declined: ${record.reason}` : 'Declined';
    case 'adopted-as-setting':
      return record.setting ? `Now a setting: ${record.setting}` : 'Now a setting';
    case 'built-differently': {
      const note = record.reason ? `Built another way: ${record.reason}` : 'Built another way';
      return record.version ? `${note} in ${record.version}` : note;
    }
    case 'moved':
      return record.reason ? `Now part of: ${record.reason}` : 'Now part of another story';
    default:
      return 'Sent';
  }
}

/** A link, when it is a web link: nothing else is drawn as one. */
export function webLink(value: string | undefined): string | undefined {
  return value !== undefined && /^https:\/\/\S+$/.test(value) ? value : undefined;
}

/** How often a screen that is up asks for the status. */
export const DEFAULT_POLL_MS = 20_000;

/** The part of the page watchStatuses listens to; the browser's document fits. */
export interface Visibility {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface WatchOptions {
  everyMs?: number;
  /** Told after each ask whether it failed, so the screen can say it could not check just now. */
  onResult?: (failed: boolean) => void;
  /** The page whose visibility is watched; the global document by default. */
  page?: Visibility;
}

/** Asks `refresh` when called, every `everyMs` after, and at once when the page is shown again; never while it is hidden, one ask at a time
 * (shown again during an ask, the next starts as that one ends). Returns the function that stops it. */
export function watchStatuses(refresh: () => Promise<unknown>, options: WatchOptions = {}): () => void {
  const everyMs = options.everyMs ?? DEFAULT_POLL_MS;
  const page: Visibility | undefined = options.page ?? (typeof document === 'undefined' ? undefined : document);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asking = false;
  let again = false;
  const run = async (): Promise<void> => {
    clearTimeout(timer);
    asking = true;
    if (!page?.hidden) {
      try {
        await refresh();
        if (!stopped) options.onResult?.(false);
      } catch {
        if (!stopped) options.onResult?.(true);
      }
    }
    asking = false;
    if (stopped) return;
    if (again) {
      again = false;
      void run();
    } else timer = setTimeout(() => void run(), everyMs);
  };
  const onVisible = (): void => {
    if (page?.hidden || stopped) return;
    if (asking) again = true;
    else void run();
  };
  page?.addEventListener('visibilitychange', onVisible);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    page?.removeEventListener('visibilitychange', onVisible);
  };
}
