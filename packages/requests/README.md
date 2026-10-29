# @pwa-kit/requests

A request to the maker, filed by the tutor from a talk. Lifted from Lampas's feedback, requests screen and Ask for more. The
person **talks to the tutor** and the tutor files what they said; there is no form here and the kit offers no free-text form. The
kit knows **no app**: sending, storage, the reader of statuses and the clock are yours, passed in as arguments. React 18 or later is
the one peer dependency; it imports nothing else.

What it does:

1. **`createRequests`** gives you `fileFromTalk({ talkId, words, who, kind })`. It builds the request (`MakerRequest`: the words, the
   tutor's one-line summary, the talk, who asked and the app's version), hands it to your `send`, and keeps it. The same words from
   the same person (capitals and spacing ignored) filed twice in a day are **one request**: the second answers `duplicate` with the
   request kept, and two taps at once are one too. Past the **budget per day** it refuses with `reason: 'budget'` and a `message` to
   show; empty words and words over 4000 characters are refused too. A send that fails throws and keeps nothing, so the same words
   may be tried again.
2. **Who asked** is part of every request: a learner id, or `GROWN_UP`. `RequestsList` groups by who.
3. **The expected asks**, the things people are expected to ask for, are listed once (`defineExpectedAsks`, or read back from JSON
   with `expectedAsksFromJson`) so the settings can show a row for each (`askRows`): its title, what a talk about it opens with,
   and where the latest request for it stands.
4. **The status** is seen through a **reader you inject**: `refresh()` gives it the requests still open and keeps the updates it
   returns (`filed`, `building`, `landed`, `declined`, `adopted-as-setting`, `built-differently`, `moved`; the newest by time wins). `watchStatuses(refresh)`
   asks now, every 20 s, and when the page is shown again; never while it is hidden.
5. **`RequestsList`** draws the requests, a group for each person, each with where it stands (Sent, Filed, Being built, Adopted in
   2.0.0 as a link to the change, Declined: why, Now a setting: name, Built another way: note, Now part of: title).

| Status | Final | Means | Fields it carries | Drawn as |
| --- | --- | --- | --- | --- |
| `sent` | no | the maker's side has the request | | Sent |
| `filed` | no | it is on the maker's list | `bead` | Filed |
| `building` | no | it is being built | `bead` | Being built |
| `landed` | yes | it came in | `bead`, `version`, `commit`, `url` | Adopted in 2.0.0 (a link when `url` is a web link) |
| `declined` | yes | the answer is no | `reason` | Declined: why |
| `adopted-as-setting` | yes | it became a setting | `setting` | Now a setting: name |
| `built-differently` | yes | the ask was answered another way than the request said | `reason` (the note), `bead`, `version`, `commit`, `url` | Built another way: note, in 2.0.0 when it has one |
| `moved` | no | the request now follows another story | `bead` (the new story), `reason` (its title) | Now part of: title |

A reader lands before the writer: an app's reader drops a status it does not know and the maker's side sends each status once, so
update the kit and the app's reader to pass `built-differently` and `moved` through before the maker's side sends them.

<!-- toc -->

- [Install](#install)
- [Use](#use)
- [The pieces](#the-pieces)
  - [What the app owns](#what-the-app-owns)
- [Develop](#develop)

<!-- /toc -->

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

```tsx
import { useEffect, useState } from 'react';
import {
  GROWN_UP, RequestsList, askRows, createJsonStore, createRequests, defineExpectedAsks, watchStatuses,
  type RequestRecord,
} from 'pwa-kit/requests';

// What the person may be expected to ask for: one row each in your settings.
const ASKS = defineExpectedAsks([
  { id: 'night-mode', title: 'A night mode', kind: 'setting', hint: 'Dark colours.', opening: "I'd like a night mode " },
  { id: 'new-text', title: 'Another text', kind: 'text' },
]);

const requests = createRequests({
  appVersion: '1.4.0',
  perDay: 5, // all people together; DEFAULT_PER_DAY when left out
  store: createJsonStore(localStorage), // or your own { all(), put(record) } over IndexedDB
  // Your wire. Map the request to your grind or API and answer the id the maker's side knows it by.
  send: async (request) => ({ id: await postToTheMaker(request) }),
  // Your reader: the open requests in, the updates you have for them out (keep your own cursor).
  readStatuses: async (open) => pullStatusRecords(open),
});

// The tutor's "Send this to the makers" button calls this with what the talk gathered:
const result = await requests.fileFromTalk({ talkId: 'talk-12', words: 'I want a night mode', who: 'ruth', kind: 'setting', askId: 'night-mode' });
if (result.outcome === 'refused') showNote(result.message); // 'That is 5 requests a day, and today's are spent. Ask again tomorrow.'
// 'sent' or 'duplicate': say Sent. result.record is the request kept.

export function YourRequests() {
  const [records, setRecords] = useState<RequestRecord[]>([]);
  useEffect(() => {
    const load = () => requests.list().then(setRecords);
    void load();
    return watchStatuses(async () => { await requests.refresh(); await load(); }); // stops when the screen goes
  }, []);
  return <RequestsList records={records} names={{ [GROWN_UP]: 'A grown-up', ruth: 'Ruth' }} order={[GROWN_UP, 'ruth']} empty="Nothing asked yet." />;
}

// In Settings: askRows(ASKS, records) is a row for each expected ask, with the status of the latest request for it.
```

## The pieces

| Export | What it is |
| --- | --- |
| `createRequests` | `fileFromTalk`, `list`, `budget`, `refresh` over a sender, a store, a reader and a clock you pass in |
| `createJsonStore` | a store over `localStorage` or any `getItem` / `setItem` pair; or write your own `{ all, put }` |
| `GROWN_UP`, `dayOf`, `MAX_WORDS` | who asked when a grown-up did; the person's own calendar day (never the UTC day); the longest words |
| `defineExpectedAsks`, `expectedAsksToJson`, `expectedAsksFromJson`, `askRows` | the expected asks, checked, kept as JSON, and drawn as settings rows |
| `watchStatuses`, `applyUpdates`, `statusLine`, `isFinal` | polling the reader without asking while hidden; keeping updates; the words for a status |
| `budgetOf`, `budgetMessage`, `DEFAULT_PER_DAY` | the day's budget counted from the requests kept |
| `RequestsList`, `groupByWho` | the list, grouped by who asked |

### What the app owns

- The wire. `send` gets a `MakerRequest` (`kind`, `text`, `summary`, `reference` = the talk, `who`, `app_version`); mapping it to
  your grind's input schema (Lampas's `tutor-ask`) is yours.
- The talk. The tutor deciding to offer "Send this to the makers", and the button, are yours; the kit takes what the talk gathered.
- Storage and the reader of statuses.
- The words on screen: names for each person and kind, the empty note, the settings rows. Style the `bk-requests__*` classes; no
  stylesheet is shipped.

## Develop

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

The tests use a neutral app and need no network.
