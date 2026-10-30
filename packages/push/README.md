# @pwa-kit/push

Notify me on a phone: the permission asked in plain words, the push subscription posted to the app's backend signed by the app's key,
and unsubscribe. Lifted from Postern's `src/services/push.ts`. The backend, the key and the service worker are the app's; the kit holds the
sequence and the words. It imports nothing and has no dependency.

<!-- toc -->

- [Install](#install)
- [Set up](#set-up)
- [The three calls](#the-three-calls)
- [The words](#the-words)
- [iOS](#ios)
- [Account-scoped registrations](#account-scoped-registrations)
- [Testing an app that uses it](#testing-an-app-that-uses-it)
- [API](#api)

<!-- /toc -->

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Set up

Two things come from the app.

1. **The VAPID public key.** The backend signs its pushes with a VAPID key pair; the browser needs the public half (base64url) to
   subscribe. Pass it as `vapidPublicKey`, or leave it out and the kit reads it once from the backend (`GET /push/vapid-public-key`,
   answering `{ "publicKey": "..." }`) through the signer.
2. **The signer.** An object with `fetch(path, init)` that calls the backend below its `/api` and signs the call with the app's key.
   [bsv-kit](https://github.com/Jonathan-A-White/bsv-kit)'s `Door` is one as it stands: `new Door({ baseUrl, key })`. The backend URL lives
   in the signer, so the kit has none of its own. Any object of that shape works, so an app that signs another way passes its own.

The app also gives the recipient public key (`publicKeyHex`) the pushes are for; it is sent with the subscription.

```ts
import { Door } from 'bsv-kit';
import { createPush } from 'pwa-kit/push';

const push = createPush({
  signer: new Door({ baseUrl: 'https://postern.example', key }), // signs each call
  publicKeyHex,                                                  // whose pushes these are
  vapidPublicKey: 'BNcRdreALRFXTk...',                           // optional: read from the backend when left out
});
```

## The three calls

```ts
await push.status();      // { state: 'on' | 'off' | 'denied' | 'unsupported', line: 'one plain line to show' }
await push.subscribe();   // asks the phone's permission (if not yet asked), subscribes, posts the subscription once; answers the status
await push.unsubscribe(); // cancels this phone's subscription and posts the removal; answers the status
```

- `status()` is read from the phone each time (the permission and the push manager's own subscription), never from memory, so a button
  that says On is right after a reload.
- `subscribe()` answers a status, so a blocked phone is a line to show and not an exception: `{ state: 'denied', line: 'Notifications are
  blocked for this app. Allow them in your phone’s settings for this app, then come back and try again.' }`. A dismissed prompt answers
  `off` and may be asked again. It throws a `PushError` (its `message` a plain line, `status` the backend's HTTP status when the backend
  refused) when the push service or the backend refuses; a subscription the backend did not accept is taken back down, so the app never
  shows On with nothing arriving.
- `unsubscribe()` cancels the browser's subscription first (that is what stops the pushes), then posts
  `{ pubkey, endpoint }` to `/push/unsubscribe`. If the backend cannot take the news the cancel stands: a backend drops a dead endpoint
  on its next push. Pass `paths: { unsubscribe: null }` for a backend with no removal call.

The backend call `subscribe()` makes is `POST /push/subscribe` with `{ "pubkey": "<hex>", "subscription": { "endpoint", "keys" } }`;
rename any of the three paths with `paths`.

## The words

`push.words` (and `DEFAULT_WORDS`) are the labels and lines for the screen: `turnOn` ("Notify me"), `turnOff`, `ask` (what to say before the
phone asks), `off`, `on`, `denied`, `unsupported`, and the two errors `subscribeFailed` and `backendFailed`. Replace any of them with
`words: { denied: '...' }`.

## iOS

Web Push on an iPhone or iPad works only for an app installed to the Home Screen, on iOS or iPadOS 16.4 or later. In Safari's tab there
is no `PushManager`, so `status()` and `subscribe()` answer `unsupported`, with the line telling the person to add the app to the Home
Screen first. Permission must be asked from a tap: call `subscribe()` from a button's handler, not on load.

## Account-scoped registrations

`subscribe()` subscribes on `navigator.serviceWorker.ready` unless the app passes `registration: () => Promise<registration>`. An app with a
push-only registration per account (Postern's) passes that account's.

## Testing an app that uses it

Everything the kit touches is an argument: pass a fake `signer`, a fake `registration`, a fake `notification` (`{ permission,
requestPermission() }`) and `supported: () => true`, as the kit's own tests do. Nothing needs a browser or a network.

## API

`createPush(options)` answers `{ subscribe, unsubscribe, status, words }`. Also exported: `DEFAULT_WORDS`, `PushError`,
`urlBase64ToBytes`, and the types `Push`, `PushOptions`, `PushPaths`, `PushSigner`, `PushState`, `PushStatus`, `PushWords`,
`NotificationLike`, `RegistrationLike`, `SubscriptionLike`.
