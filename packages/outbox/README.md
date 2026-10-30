# @pwa-kit/outbox

The outgoing queue of an app that must not lose a write: every write goes into the app's Dexie table first and the caller goes on at
once; one sender then takes the waiting items in order, with a timeout and a growing retry wait, only while the page is online and in
front of the user. A client id travels with every try, so a retry never doubles. Lifted from Postern's `src/services/outbox.ts` and the
smaller twin in Trade Tracker's lookup runner. The table, the sender and the words are the app's; the kit holds the sequence. It
imports nothing and has no dependency.

<!-- toc -->

- [Install](#install)
- [The table](#the-table)
- [The sender](#the-sender)
- [The calls](#the-calls)
- [The status words](#the-status-words)
- [When it sends](#when-it-sends)
- [Testing an app that uses it](#testing-an-app-that-uses-it)
- [API](#api)

<!-- /toc -->

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## The table

A Dexie table keyed by `clientId`. Declare it in the app's own database; the kit never opens a database.

```ts
db.version(1).stores({ outbox: 'clientId, queuedAt' });
const table = db.table<OutboxItem<Note>, string>('outbox');
```

Each row is an `OutboxItem<P>`:

| Field | Meaning |
| --- | --- |
| `clientId` | the write's id, made when it was queued; the table's primary key; sent with every try |
| `payload` | what the app wants sent (`P`, the app's own type) |
| `stage` | `waiting`, `sending`, `sent` or `failed` |
| `queuedAt` | when it was queued (ms); the order it is sent in |
| `attempts` | how many tries have ended |
| `nextAt` | while `waiting` after a passing failure: not before this time (ms) |
| `reason` | why the last try failed: a `failed` item's reason, or a `waiting` item's passing trouble; cleared when sent |
| `sentAt` | when it was sent (ms) |

The table is typed as a shape (`OutboxTable<P>`: `get`, `add`, `put`, `delete`, `toArray`), so a Dexie `Table` fits as it is and so does a
`Map` behind the same five methods, for a test.

## The sender

```ts
import { PermanentSendError, createOutbox } from 'pwa-kit/outbox';

const outbox = createOutbox<Note>({
  table,
  sender: async (item, { signal }) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      signal, // aborted when the send outruns its time
      body: JSON.stringify({ id: item.clientId, ...item.payload }), // the client id goes with it
    });
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      throw new PermanentSendError(`The server said ${res.status}.`); // never going to work: failed, with this reason
    }
    if (!res.ok) throw new Error(`The server said ${res.status}.`); // anything else is passing: tried again
  },
  onStatus: (status) => (label.textContent = status.line),
});
outbox.start();
```

**The sender must be idempotent on the client id.** The same `item.clientId` can reach it more than once: a send that timed out may
have landed, a page closed in the middle of a send does not know whether it did, and a retry sends it again. The receiver must store a
write with a client id it has already seen once, and answer success for the repeat. If it cannot, a retry doubles the write.

- Resolve when the receiver has it. The value is not kept.
- Throw for a passing trouble (a cut connection, a 5xx, a 408 or 429): the item stays `waiting`, keeps its place and its reason, and goes
  again after the wait.
- Throw a `PermanentSendError` (or whatever `isPermanent` says is final) for a write that can never go: the item becomes `failed` with the
  error's message as its reason, waits for `retry` or `discard`, and the items behind it go on.
- A passing failure holds the items behind it until it is tried again, so the writes reach the receiver in the order they were made.

## The calls

```ts
const stop = outbox.start();            // puts back what a closed page left `sending`, sends what waits, and listens to the page
const item = await outbox.enqueue(payload);                  // resolves once it is in the table, not once it is sent
await outbox.enqueue(payload, { clientId: 'draft-12' });     // an id of your own; one already in the table is not queued twice
await outbox.retry(item.clientId);      // a failed item goes back in its old place and is tried at once
await outbox.discard(item.clientId);    // forgotten
await outbox.status();                  // the queue's status now
outbox.itemStatus(item);                // { state, line } for one row of a list
stop();                                 // nothing more is sent; a send in progress is aborted, and sent again after the next start
```

`enqueue` writes the table whether or not the outbox has been started, so a write made before the app has finished starting is not lost.

## The status words

`onStatus` is told the queue's status whenever it changes (and not otherwise): `{ state, line, waiting, sending, sent, failed, reason? }`.
`line` is the one label for the screen, empty when nothing is queued. A failure comes first, because it needs the user; then a send in
progress; then a wait; then Sent.

| `state` | `line` | When |
| --- | --- | --- |
| `waiting` | `Waiting for the network` | an item waits and the page is offline |
| `waiting` | `Waiting to send` | an item waits for its turn, or the page is hidden |
| `waiting` | `Will try again: <reason>` | the last try failed for a passing reason |
| `sending` | `Sending` | a send is in progress |
| `sent` | `Sent` | everything queued has gone (until sent items are forgotten, a minute) |
| `failed` | `Could not send: <reason>` | an item was refused for good; it stays until `retry` or `discard` |
| `idle` | (empty) | nothing is queued |

A send that outruns its time is a passing trouble with the reason `The send did not finish in 30 s.` Every word is replaceable with
`words` (`waitingForNetwork`, `waiting`, `sending`, `sent`, `willRetry(reason)`, `failed(reason)`, `timedOut(seconds)`), for an app that
speaks another way or another language.

## When it sends

- One item at a time, oldest first.
- Only while the page is online and visible. `browserPage()` is the default: `navigator.onLine`, `document.hidden`, and the `online`,
  `offline` and `visibilitychange` events. Coming back online or into view tries at once, not at the end of a wait.
- A timeout per send (`timeoutMs`, 30 s). The sender's `signal` is aborted, and a sender that ignores it is given up on all the same.
- A failed try waits `backoff.baseMs` (1 s), doubling each time, up to `backoff.maxMs` (5 min).
- A sent item stays in the table for `keepSentMs` (a minute) so the screen can say Sent, then is forgotten. It is never queued again.
- Two tabs on the same table are not supported: each would send the waiting items.

## Testing an app that uses it

Pass a `page` of your own (`isOnline()`, `isVisible()` and `subscribe(wake)`) to take the app offline and online by hand, fake timers
for the backoff (leave `setImmediate` real if the table is `fake-indexeddb`), and `await outbox.settled()` to wait for the sender to go
quiet. The kit's own tests do exactly this, with a Dexie database over `fake-indexeddb`.

```ts
const page = { isOnline: () => online, isVisible: () => true, subscribe: (wake) => (wakes.add(wake), () => wakes.delete(wake)) };
```

## API

| Export | What it is |
| --- | --- |
| `createOutbox(options)` | the outbox: `enqueue`, `start`, `retry`, `discard`, `kick`, `status`, `itemStatus`, `settled` |
| `PermanentSendError` | throw it from a sender for a write that can never go |
| `SendTimeoutError` | the error a timed-out send is kept under |
| `browserPage()` | the page the outbox runs in, from the browser |
| `itemStatus(item, online, words?)`, `queueStatus(items, online, words?)` | the words for one item and for the queue, as pure functions |
| `backoffMs(attempts, baseMs?, maxMs?)` | the wait after the nth failed try |
| `DEFAULT_WORDS` | the words, to read or to start from |
| types | `Outbox`, `OutboxOptions`, `OutboxSender`, `OutboxTable`, `SendContext`, `OutboxPage`, `OutboxItem`, `OutboxStage`, `OutboxStatus`, `ItemStatus`, `OutboxWords` |
