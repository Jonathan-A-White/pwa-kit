# @pwa-kit/day

The user's own calendar day as a `'YYYY-MM-DD'` key, never the UTC day, and an ESLint rule that keeps the UTC day out.
No DOM and no dependency (ESLint is an optional peer, for the rule only).

The bug it fixes: `new Date().toISOString().slice(0, 10)` is the UTC day. At 22:30 in New York that is already
tomorrow, so a "today" line, a streak or a daily count reads the wrong day for the last hours of every evening west of
UTC. And `new Date('2026-10-14')` is UTC midnight, which reads 13 October west of UTC.

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

`pwa-kit/day`:

```ts
import { addDays, dayStart, isDay, localDay } from 'pwa-kit/day';

localDay();                       // today, e.g. '2026-10-13', from the local calendar fields
localDay(new Date(2026, 9, 13, 22, 30)); // '2026-10-13' in New York, not the UTC day after
dayStart('2026-10-14');           // a Date at local midnight of that day (what new Date('2026-10-14') is not)
addDays('2026-10-31', 1);         // '2026-11-01'
addDays('2026-11-01', 1);         // '2026-11-02': a DST change never skips or repeats a day
addDays('2026-11-02', -7);        // a week back
isDay('2026-02-30');              // false: a well-formed key of a real day, or not
```

- `localDay(at = new Date())` takes a `Date` or milliseconds and returns the local day.
- `dayStart(day)` is local midnight of `day`.
- `addDays(day, n)` steps `n` whole days (negative goes back) through local calendar fields, not by adding 24 hours.
- `isDay(text)` is true for a well-formed key of a real day (`2026-02-30` is not).
- A bad day string, a fractional count or an invalid date throws a `DayError` (its `name` is `'DayError'`).

## The lint rule

`pwa-kit/day/eslint` is an ESLint 9 flat-config plugin (`pwa-kit-day`) with one rule, `no-utc-day`, and a config object
that turns it on as an error. Put it in the array in your `eslint.config.js`:

```js
import dayLint from 'pwa-kit/day/eslint';

export default [
  // ...your other config
  dayLint, // or { ...dayLint, files: ['src/**/*.{ts,tsx}'] } to scope it
];
```

The rule reports `x.toISOString().split('T')[0]` (any `.split('T')` on a `toISOString()`), `.toISOString().slice(0, 10)`,
`.substring(0, 10)` and `.substr(0, 10)`, and `new Date('<a bare YYYY-MM-DD literal>')`, with a message that names
`localDay` or `dayStart`. A real UTC key, one a server sends or expects, is kept with an eslint-disable line that gives the
reason:

```ts
// eslint-disable-next-line pwa-kit-day/no-utc-day -- the server's day key is the UTC day by contract
const key = sentAt.toISOString().slice(0, 10);
```

It is a plugin, not a `no-restricted-syntax` fragment: an app's own `no-restricted-syntax` entries would be overwritten
by a shared one.
