// The asks an app expects people to make, listed once so its settings can show them as rows.

/** One ask the app expects: a stable id, the words for the row, the kind it files under, and what a talk about it opens with. */
export interface ExpectedAsk {
  /** Stable and unique within the list. */
  id: string;
  title: string;
  /** The kind a request for it is filed under, the app's own word. */
  kind: string;
  /** A line under the title. */
  hint?: string;
  /** What the talk's box opens with, for the person to finish ("I'd like it to have "). */
  opening?: string;
}

/** A bad list of expected asks, or JSON that is not one. */
export class ExpectedAsksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpectedAsksError';
  }
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined);

/** The list checked and copied: an ask needs an id, a title and a kind, and no two share an id. */
export function defineExpectedAsks(asks: readonly ExpectedAsk[]): ExpectedAsk[] {
  const seen = new Set<string>();
  return asks.map((ask, i) => {
    const at = `expected ask ${i + 1}`;
    const id = text(ask.id);
    if (id === undefined) throw new ExpectedAsksError(`${at} needs an id`);
    if (seen.has(id)) throw new ExpectedAsksError(`two expected asks have the id ${id}`);
    seen.add(id);
    const title = text(ask.title);
    if (title === undefined) throw new ExpectedAsksError(`expected ask ${id} needs a title`);
    const kind = text(ask.kind);
    if (kind === undefined) throw new ExpectedAsksError(`expected ask ${id} needs a kind`);
    const copy: ExpectedAsk = { id, title, kind };
    if (typeof ask.hint === 'string') copy.hint = ask.hint;
    if (typeof ask.opening === 'string') copy.opening = ask.opening;
    return copy;
  });
}

export function expectedAsksToJson(asks: readonly ExpectedAsk[]): string {
  return JSON.stringify(defineExpectedAsks(asks));
}

/** A list read back from JSON (a data file the app ships, say), checked as defineExpectedAsks does. Fields it does not know are dropped. */
export function expectedAsksFromJson(json: string): ExpectedAsk[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ExpectedAsksError('the expected asks are not JSON');
  }
  if (!Array.isArray(parsed)) throw new ExpectedAsksError('the expected asks are not a list');
  return defineExpectedAsks(
    parsed.map((item): ExpectedAsk => {
      const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const ask = { id: o.id, title: o.title, kind: o.kind, hint: o.hint, opening: o.opening };
      return ask as ExpectedAsk;
    }),
  );
}

/** One row of the settings for an expected ask: what it says, and whether and how far a request for it has come. */
export interface AskRow {
  id: string;
  title: string;
  kind: string;
  hint: string;
  /** What the talk opens with; '' for none. */
  opening: string;
  /** Whether a request was filed for it. */
  asked: boolean;
  /** Where the latest request for it stands. */
  status?: string;
  /** The id of that request. */
  requestId?: string;
}

/** A row for each expected ask, in list order, with the latest request filed for it (a request names the ask by `askId`). */
export function askRows(asks: readonly ExpectedAsk[], records: readonly { id: string; askId?: string | undefined; sentAt: number; status: string }[]): AskRow[] {
  return asks.map((ask) => {
    const latest = records.filter((r) => r.askId === ask.id).reduce<(typeof records)[number] | undefined>((a, r) => (a === undefined || r.sentAt >= a.sentAt ? r : a), undefined);
    const row: AskRow = { id: ask.id, title: ask.title, kind: ask.kind, hint: ask.hint ?? '', opening: ask.opening ?? '', asked: latest !== undefined };
    if (latest) {
      row.status = latest.status;
      row.requestId = latest.id;
    }
    return row;
  });
}
