// A budget of requests per day, counted from the requests kept, so it survives a reload and needs no clock of its own.

/** How many requests an app files in a day unless it says otherwise. */
export const DEFAULT_PER_DAY = 5;

export interface Budget {
  limit: number;
  used: number;
  left: number;
}

/** The budget of `day` (YYYY-MM-DD): how many of `records` were filed that day. */
export function budgetOf(records: readonly { day: string }[], day: string, limit: number): Budget {
  const used = records.filter((r) => r.day === day).length;
  return { limit, used, left: Math.max(0, limit - used) };
}

/** What a person is told when the day's budget is spent. */
export function budgetMessage(limit: number): string {
  return limit === 1
    ? "That is 1 request a day, and today's is spent. Ask again tomorrow."
    : `That is ${limit} requests a day, and today's are spent. Ask again tomorrow.`;
}
