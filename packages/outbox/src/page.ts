// What the outbox asks of the page it runs in: is it online, is it in front of the user, and tell me when either changes.
// A test or an app that has its own idea of either passes its own; `browserPage()` is the browser's.

/** The page the outbox runs in. It sends only while `isOnline()` and `isVisible()` are both true, and looks again when `subscribe`'s wake is called. */
export interface OutboxPage {
  isOnline(): boolean;
  isVisible(): boolean;
  /** Calls `wake` whenever the page goes online or offline, or is shown or hidden; answers the call that stops it. */
  subscribe(wake: () => void): () => void;
}

interface Events {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface Browser {
  navigator?: { onLine?: boolean };
  document?: Events & { hidden?: boolean };
  addEventListener?: Events['addEventListener'];
  removeEventListener?: Events['removeEventListener'];
}

/** The browser's own: `navigator.onLine`, `document.hidden`, and the `online`, `offline` and `visibilitychange` events. Outside a browser it is always online and visible. */
export function browserPage(): OutboxPage {
  const g = globalThis as unknown as Browser;
  return {
    isOnline: () => g.navigator?.onLine !== false,
    isVisible: () => g.document?.hidden !== true,
    subscribe(wake) {
      g.addEventListener?.('online', wake);
      g.addEventListener?.('offline', wake);
      g.document?.addEventListener('visibilitychange', wake);
      return () => {
        g.removeEventListener?.('online', wake);
        g.removeEventListener?.('offline', wake);
        g.document?.removeEventListener('visibilitychange', wake);
      };
    },
  };
}
