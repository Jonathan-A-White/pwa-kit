# Changelog: @pwa-kit/outbox

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-30)

- New: `createOutbox` with `enqueue()`, `start()`, `retry()`, `discard()`, `status()` and `itemStatus()`: the outgoing queue of an app that
  must not lose a write. Every write is put in the app's Dexie table first and the caller goes on; one sender takes the waiting items in
  the order they were queued, one at a time, each with a timeout (30 s, replaceable), and a failed try is tried again after 1 s,
  doubling to 5 min. A client id is made when the write is queued and goes with every try. A sent item is kept (a minute, replaceable)
  and is never sent again, after a reload or otherwise; an item left `sending` by a closed page is sent again, by the same client id.
  It sends only while the page is online and visible (`browserPage()`, or the page the app passes), and tells `onStatus` an honest line:
  `Waiting for the network`, `Waiting to send`, `Sending`, `Will try again: <reason>`, `Sent`, `Could not send: <reason>`, every one
  replaceable. Lifted from Postern's `src/services/outbox.ts` (mw-mr4xgrw.8) and the smaller twin in Trade Tracker's lookup runner.
  No dependencies; the table is a shape a Dexie `Table` fits.
- Left with the app, not lifted: Postern's lanes, its accounts, its chain delivery, its acks by a record coming back, and the
  backend's journal report. They are the sender's business, or a layer over it.
