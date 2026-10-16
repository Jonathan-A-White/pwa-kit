// The user's own calendar day as a 'YYYY-MM-DD' key, from the local calendar fields and never the UTC day: at 22:30 in New York
// the UTC day is already tomorrow. No DOM, no dependency.

/** Thrown for a day string that is not a real 'YYYY-MM-DD', or a date that is not a time. */
export class DayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DayError';
  }
}

const SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

const two = (n: number): string => String(n).padStart(2, '0');

/** A local date at the given hour of that calendar day; setFullYear keeps a year below 100 from becoming 19xx. */
function at(year: number, month: number, date: number, hour: number): Date {
  const d = new Date(2000, 0, 1, hour);
  d.setFullYear(year, month, date);
  return d;
}

/** The parts of a real day key, or null. A key that rolls over (2026-02-30) is not a real day. */
function parts(day: unknown): [number, number, number] | null {
  if (typeof day !== 'string') return null;
  const m = SHAPE.exec(day);
  if (!m) return null;
  const [year, month, date] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = at(year, month - 1, date, 12);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === date ? [year, month, date] : null;
}

function need(day: string): [number, number, number] {
  const p = parts(day);
  if (!p) throw new DayError(`not a day, expected a real YYYY-MM-DD: ${JSON.stringify(day)}`);
  return p;
}

/** True when `text` is a well-formed key of a real day, 'YYYY-MM-DD'. */
export function isDay(text: unknown): text is string {
  return parts(text) !== null;
}

/** The local day of `at` ('YYYY-MM-DD'), now by default. At 22:30 in New York this is today, not the UTC day after. */
export function localDay(at: Date | number = new Date()): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) throw new DayError(`not a time: ${String(at)}`);
  return `${String(d.getFullYear()).padStart(4, '0')}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/**
 * Local midnight at the start of `day`. The safe replacement for a Date made from a bare 'YYYY-MM-DD' string, which is
 * UTC midnight and reads a day early west of UTC.
 */
export function dayStart(day: string): Date {
  const [year, month, date] = need(day);
  const d = at(year, month - 1, date, 0);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The day `n` days after `day` (before, when negative), through local calendar fields: a DST change never skips or repeats a day. */
export function addDays(day: string, n: number): string {
  const [year, month, date] = need(day);
  if (!Number.isInteger(n)) throw new DayError(`not a whole number of days: ${String(n)}`);
  // noon, so a midnight that a DST change skips or repeats cannot move the date
  return localDay(at(year, month - 1, date + n, 12));
}
