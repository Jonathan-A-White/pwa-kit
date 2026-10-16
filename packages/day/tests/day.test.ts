// pwa-kit/day: the user's own calendar day, never the UTC day. Run under several TZ values (TZ=America/New_York, TZ=UTC,
// TZ=Pacific/Auckland): the answers that depend on the zone are asserted from the local calendar fields.
import { describe, expect, it } from 'vitest';
import { DayError, addDays, dayStart, isDay, localDay } from '../src/day.js';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const inNewYork = zone === 'America/New_York';

describe('localDay', () => {
  it('reads the local calendar fields, in whatever zone the tests run', () => {
    expect(localDay(new Date(2026, 9, 13, 22, 30))).toBe('2026-10-13');
    expect(localDay(new Date(2026, 9, 14, 0, 5))).toBe('2026-10-14');
    expect(localDay(new Date(2026, 11, 31, 23, 59, 59, 999))).toBe('2026-12-31');
    expect(localDay(new Date(2026, 0, 1, 0, 0, 0, 0))).toBe('2026-01-01');
  });

  it.skipIf(!inNewYork)('at 22:30 in New York is still that day, not the UTC day after', () => {
    expect(localDay(new Date('2026-10-13T22:30:00-04:00'))).toBe('2026-10-13');
    expect(new Date('2026-10-13T22:30:00-04:00').toISOString().startsWith('2026-10-14')).toBe(true);
  });

  it('takes a number of milliseconds as well as a Date', () => {
    const at = new Date(2026, 5, 7, 18, 0);
    expect(localDay(at.getTime())).toBe(localDay(at));
  });

  it('defaults to now', () => {
    expect(localDay()).toBe(localDay(new Date()));
    expect(isDay(localDay())).toBe(true);
  });

  it('pads the year, the month and the day', () => {
    const d = new Date(2026, 0, 5, 12);
    expect(localDay(d)).toBe('2026-01-05');
  });

  it('throws a named error for an invalid date', () => {
    expect(() => localDay(new Date('nope'))).toThrow(DayError);
    expect(() => localDay(NaN)).toThrow(DayError);
  });
});

describe('dayStart', () => {
  it('is local midnight of that day, in whatever zone the tests run', () => {
    const d = dayStart('2026-10-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('is not the UTC midnight that new Date(day) gives', () => {
    // west of UTC, new Date('2026-10-14') reads 13 October; dayStart never does
    expect(dayStart('2026-10-14').getDate()).toBe(14);
    expect(localDay(dayStart('2026-10-14'))).toBe('2026-10-14');
  });

  it('round-trips through localDay for every day of a year that has two DST changes', () => {
    let day = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      expect(localDay(dayStart(day))).toBe(day);
      day = addDays(day, 1);
    }
    expect(day).toBe('2027-01-01');
  });

  it('throws a named error for a bad day', () => {
    expect(() => dayStart('2026-10-14T00:00:00Z')).toThrow(DayError);
    expect(() => dayStart('2026-02-30')).toThrow(DayError);
  });
});

describe('addDays', () => {
  it('steps over the New York DST change on 2026-11-01 without skipping or repeating a day', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('steps over the Auckland DST changes without skipping or repeating a day', () => {
    expect(addDays('2026-09-26', 1)).toBe('2026-09-27');
    expect(addDays('2026-09-27', 1)).toBe('2026-09-28');
    expect(addDays('2026-04-04', 1)).toBe('2026-04-05');
    expect(addDays('2026-04-05', 1)).toBe('2026-04-06');
  });

  it('crosses months, years and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('adds nothing for 0 and many days at once', () => {
    expect(addDays('2026-10-14', 0)).toBe('2026-10-14');
    expect(addDays('2026-10-14', 30)).toBe('2026-11-13');
    expect(addDays('2026-10-14', -287)).toBe('2025-12-31');
  });

  it('throws a named error for a bad day or a fractional count', () => {
    expect(() => addDays('2026-1-4', 1)).toThrow(DayError);
    expect(() => addDays('2026-10-14', 0.5)).toThrow(DayError);
    expect(() => addDays('2026-10-14', NaN)).toThrow(DayError);
  });
});

describe('isDay', () => {
  it('accepts a well-formed key of a real day', () => {
    expect(isDay('2026-10-14')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of ['', '2026-1-4', '2026-13-01', '2026-02-30', '2027-02-29', '2026-10-14T00:00:00Z', ' 2026-10-14', '14/10/2026', 'today']) {
      expect(isDay(bad), bad).toBe(false);
    }
    expect(isDay(20261014)).toBe(false);
    expect(isDay(null)).toBe(false);
  });
});

describe('DayError', () => {
  it('is named, and carries what was wrong', () => {
    let error: unknown;
    try {
      dayStart('2026-02-30');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DayError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('DayError');
    expect((error as Error).message).toContain('2026-02-30');
  });
});
