# Changelog: @pwa-kit/requests

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-26)

- New: two request statuses in the vocabulary (`REQUEST_STATUSES`, `StatusUpdate`, `moved()`, `statusLine`, `RequestsList`):
  `built-differently` (final; `reason` is the one-sentence note, `bead` the story that did it, `version`, `commit` and `url` when it
  landed; "Built another way: <note>", with " in <version>" when it has one, a link when it has a web url) and `moved` (not final;
  `bead` is the new story and `reason` its title; "Now part of: <title>", or "Now part of another story" with no title). Order of
  landing: the kit, then the app's reader, then the factory's writer last, because an app's reader drops a status it does not know
  and the factory sends each status once (mw-5r3p30.797).

## 0.1.0 (2026-10-22)

- New: `createRequests` (`fileFromTalk`, `list`, `budget`, `refresh`), the expected asks (`defineExpectedAsks`, `askRows`, JSON in and
  out), the status seen through an injected reader (`watchStatuses`, `statusLine`) and `RequestsList`, grouped by who asked, carved
  from Lampas's `src/services/feedback.ts`, `requestStatus.ts`, `requestBudget.ts`, `data/repositories/requests.ts`, `RequestsScreen`
  and `settings/AskMoreScreen` (mw-79en7t.10).
- Changed from Lampas: a request is filed from a talk, never from a form: the kit has no free-text form, and Lampas's per-kind forms
  (Ask for more) stay in Lampas until they become rows that open a talk. The sender, the store, the reader of statuses (Lampas pulls
  the mill's sealed records itself) and the clock are arguments. The request carries `who` (a learner id or `GROWN_UP`), which Lampas
  did not track; the same words from the same person twice in a day are one request, and a budget per day is counted from the
  requests kept (Lampas's `requestBudget` capped the size of a request, which stays the app's sender's business).
- Tests: a neutral app; the cases of one request per talk, once a day, the budget, the expected asks round trip, the status and
  `RequestsList` grouped by who.
- Sweep (mw-79en7t.10): hand-written request code elsewhere, with a verdict. spell-forge `src/features/feedback` (`feedback-form.tsx`,
  `mailto.ts`, `use-offline-feedback-sync.ts`, `feedback-sync-banner.tsx`): a free-text Composer form that opens a `mailto:` and queues
  the words locally. Not carved: it is the form this kit does not offer; spell-forge adopts `fileFromTalk` when it has a tutor talk,
  and the form and its mailto go then. postern: no request-to-the-maker code (its `todo/links.ts` `mailto:` is an Email button on a
  link in a person's own list, and its cockpit cards answer the Mayor, which is not a request for a change); nothing to move.
