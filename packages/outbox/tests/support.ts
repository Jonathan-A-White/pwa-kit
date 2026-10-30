// A Dexie database over fake-indexeddb, a page the test can take on and offline and hide, and a sender that can be told what to do.
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import type { OutboxItem, OutboxPage } from '../src/index.js';

export interface Note {
  text: string;
}

let dbs = 0;

/** A fresh database, as an app's own: the table is keyed by `clientId`. Call `reopen` to see the same rows after a reload. */
export function openDatabase(name = `outbox-test-${++dbs}`): { db: Dexie; table: Table<OutboxItem<Note>, string>; name: string; reopen(): { db: Dexie; table: Table<OutboxItem<Note>, string> } } {
  const open = (): { db: Dexie; table: Table<OutboxItem<Note>, string> } => {
    const db = new Dexie(name);
    db.version(1).stores({ outbox: 'clientId, queuedAt' });
    return { db, table: db.table<OutboxItem<Note>, string>('outbox') };
  };
  const first = open();
  return { ...first, name, reopen: () => {
    first.db.close();
    return open();
  } };
}

export interface FakePage extends OutboxPage {
  setOnline(online: boolean): void;
  setVisible(visible: boolean): void;
}

export function fakePage(online = true, visible = true): FakePage {
  const wakes = new Set<() => void>();
  const wake = (): void => wakes.forEach((w) => w());
  return {
    isOnline: () => online,
    isVisible: () => visible,
    subscribe(w) {
      wakes.add(w);
      return () => void wakes.delete(w);
    },
    setOnline(next) {
      online = next;
      wake();
    },
    setVisible(next) {
      visible = next;
      wake();
    },
  };
}

/** Lets the real event loop turn (fake-indexeddb runs on it, the faked timers do not) until `done()` holds. */
export async function until(done: () => boolean, what = 'the condition'): Promise<void> {
  for (let i = 0; i < 2_000; i++) {
    if (done()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`${what} never came`);
}

export const turn = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));
