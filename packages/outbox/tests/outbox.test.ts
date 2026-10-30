import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermanentSendError, createOutbox } from '../src/index.js';
import type { OutboxItem, OutboxOptions, OutboxStatus } from '../src/index.js';
import { fakePage, openDatabase, turn, until } from './support.js';
import type { Note } from './support.js';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const note = (text: string): Note => ({ text });

function build(overrides: Partial<OutboxOptions<Note>> = {}) {
  const database = openDatabase();
  const page = fakePage();
  const sent: Array<{ clientId: string; text: string }> = [];
  const statuses: OutboxStatus[] = [];
  const options: OutboxOptions<Note> = {
    table: database.table,
    sender: async (item) => void sent.push({ clientId: item.clientId, text: item.payload.text }),
    page,
    onStatus: (status) => void statuses.push(status),
    ...overrides,
  };
  const outbox = createOutbox<Note>(options);
  return { ...database, page, sent, statuses, options, outbox };
}

describe('a write queued offline', () => {
  it('is written to the table first and is sent when online fires', async () => {
    const { table, page, sent, outbox } = build();
    page.setOnline(false);
    outbox.start();
    const queued = await outbox.enqueue(note('milk'));
    expect(queued.stage).toBe('waiting');
    expect((await table.get(queued.clientId))?.payload).toEqual(note('milk'));
    await outbox.settled();
    expect(sent).toEqual([]);
    expect((await outbox.status()).line).toBe('Waiting for the network');

    page.setOnline(true);
    await outbox.settled();
    expect(sent).toEqual([{ clientId: queued.clientId, text: 'milk' }]);
    expect((await table.get(queued.clientId))?.stage).toBe('sent');
    expect((await outbox.status()).line).toBe('Sent');
  });

  it('is written even when the outbox has not been started', async () => {
    const { table, sent, outbox } = build();
    const queued = await outbox.enqueue(note('eggs'));
    expect(await table.count()).toBe(1);
    await outbox.settled();
    expect(sent).toEqual([]);
    outbox.start();
    await outbox.settled();
    expect(sent.map((s) => s.clientId)).toEqual([queued.clientId]);
  });

  it('waits while the page is hidden and goes when it is shown', async () => {
    const { page, sent, outbox } = build();
    page.setVisible(false);
    outbox.start();
    await outbox.enqueue(note('bread'));
    await outbox.settled();
    expect(sent).toEqual([]);
    expect((await outbox.status()).line).toBe('Waiting to send');
    page.setVisible(true);
    await outbox.settled();
    expect(sent).toHaveLength(1);
  });

  it('goes in the order it was queued, one at a time', async () => {
    let running = 0;
    let most = 0;
    const order: string[] = [];
    const { outbox, page } = build({
      sender: async (item) => {
        running++;
        most = Math.max(most, running);
        await turn();
        order.push(item.payload.text);
        running--;
      },
    });
    page.setOnline(false);
    outbox.start();
    for (const text of ['a', 'b', 'c']) await outbox.enqueue(note(text));
    page.setOnline(true);
    await outbox.settled();
    expect(order).toEqual(['a', 'b', 'c']);
    expect(most).toBe(1);
  });

  it('keeps the client id the caller gave it, and queues a given id once', async () => {
    const { table, sent, outbox } = build();
    const first = await outbox.enqueue(note('one'), { clientId: 'mine' });
    const again = await outbox.enqueue(note('two'), { clientId: 'mine' });
    expect(first.clientId).toBe('mine');
    expect(again.payload).toEqual(note('one'));
    expect(await table.count()).toBe(1);
    outbox.start();
    await outbox.settled();
    expect(sent).toEqual([{ clientId: 'mine', text: 'one' }]);
  });
});

describe('a send that times out', () => {
  it('is retried with the same client id after the backoff, and the sender is told to stop', async () => {
    const seen: Array<{ clientId: string; aborted: boolean }> = [];
    let calls = 0;
    const { table, outbox } = build({
      timeoutMs: 5_000,
      sender: async (item, { signal }) => {
        calls++;
        const call = calls;
        if (call === 1) {
          await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
          seen.push({ clientId: item.clientId, aborted: signal.aborted });
          return;
        }
        seen.push({ clientId: item.clientId, aborted: signal.aborted });
      },
    });
    outbox.start();
    const queued = await outbox.enqueue(note('slow'));
    await until(() => calls === 1, 'the first send');
    await vi.advanceTimersByTimeAsync(5_000);
    await outbox.settled();
    let item = await table.get(queued.clientId);
    expect(item?.stage).toBe('waiting');
    expect(item?.attempts).toBe(1);
    expect(item?.reason).toBe('The send did not finish in 5 s.');
    expect((await outbox.status()).line).toBe('Will try again: The send did not finish in 5 s.');
    expect(calls).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await outbox.settled();
    item = await table.get(queued.clientId);
    expect(calls).toBe(2);
    expect(seen.map((s) => s.clientId)).toEqual([queued.clientId, queued.clientId]);
    expect(seen[0]?.aborted).toBe(true);
    expect(item?.stage).toBe('sent');
    expect(item?.reason).toBeUndefined();
  });

  it('counts a send that never settles as timed out, though it ignores the signal', async () => {
    let called = false;
    const { table, outbox } = build({
      timeoutMs: 2_000,
      sender: () => {
        called = true;
        return new Promise<void>(() => undefined);
      },
    });
    outbox.start();
    const queued = await outbox.enqueue(note('stuck'));
    await until(() => called, 'the send');
    await vi.advanceTimersByTimeAsync(2_000);
    await outbox.settled();
    expect((await table.get(queued.clientId))?.reason).toBe('The send did not finish in 2 s.');
  });
});

describe('a send that fails', () => {
  it('backs off from 1 s, doubling to 5 min, and goes at once when online fires', async () => {
    const at: number[] = [];
    const { outbox, page, table } = build({
      sender: async () => {
        at.push(Date.now());
        throw new Error('Gateway down');
      },
    });
    outbox.start();
    const queued = await outbox.enqueue(note('x'));
    await outbox.settled();
    const start = at[0] as number;
    for (const wait of [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000, 300_000, 300_000]) {
      const before = at.length;
      await vi.advanceTimersByTimeAsync(wait - 1);
      await outbox.settled();
      expect(at.length, `before ${wait}`).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      await outbox.settled();
      expect(at.length, `at ${wait}`).toBe(before + 1);
    }
    expect(at[1]! - start).toBe(1_000);
    const before = at.length;
    page.setOnline(false);
    page.setOnline(true);
    await outbox.settled();
    expect(at.length).toBe(before + 1);
    expect((await table.get(queued.clientId))?.attempts).toBe(before + 1);
  });

  it('keeps a permanently refused item as failed with its reason, and goes on to the next', async () => {
    const { table, sent, outbox } = build({
      sender: async (item) => {
        if (item.payload.text === 'bad') throw new PermanentSendError('The backend refused it: too long.');
        sent.push({ clientId: item.clientId, text: item.payload.text });
      },
    });
    outbox.start();
    const bad = await outbox.enqueue(note('bad'));
    await outbox.enqueue(note('good'));
    await outbox.settled();
    const item = await table.get(bad.clientId);
    expect(item?.stage).toBe('failed');
    expect(item?.reason).toBe('The backend refused it: too long.');
    expect(sent.map((s) => s.text)).toEqual(['good']);
    const status = await outbox.status();
    expect(status.state).toBe('failed');
    expect(status.line).toBe('Could not send: The backend refused it: too long.');
    expect(status.failed).toBe(1);
  });

  it('judges a permanent refusal by the app\'s own rule when given one', async () => {
    const { table, outbox } = build({
      isPermanent: (err) => err instanceof Error && err.message.startsWith('4'),
      sender: async () => {
        throw new Error('422 unprocessable');
      },
    });
    outbox.start();
    const queued = await outbox.enqueue(note('x'));
    await outbox.settled();
    expect((await table.get(queued.clientId))?.stage).toBe('failed');
  });

  it('holds the items behind a passing failure, so the order is kept', async () => {
    const calls: string[] = [];
    let fail = true;
    const { outbox } = build({
      sender: async (item) => {
        calls.push(item.payload.text);
        if (fail && item.payload.text === 'first') throw new Error('offline really');
      },
    });
    outbox.start();
    await outbox.enqueue(note('first'));
    await outbox.enqueue(note('second'));
    await outbox.settled();
    expect(calls).toEqual(['first']);
    fail = false;
    await vi.advanceTimersByTimeAsync(1_000);
    await outbox.settled();
    expect(calls).toEqual(['first', 'first', 'second']);
  });

  it('retry puts a failed item back and tries it at once; discard forgets it', async () => {
    let refuse = true;
    const { table, outbox, sent } = build({
      sender: async (item) => {
        if (refuse) throw new PermanentSendError('No.');
        sent.push({ clientId: item.clientId, text: item.payload.text });
      },
    });
    outbox.start();
    const a = await outbox.enqueue(note('a'));
    const b = await outbox.enqueue(note('b'));
    await outbox.settled();
    expect((await table.toArray()).map((i) => i.stage)).toEqual(['failed', 'failed']);
    refuse = false;
    await outbox.retry(a.clientId);
    await outbox.settled();
    expect((await table.get(a.clientId))?.stage).toBe('sent');
    expect((await table.get(a.clientId))?.reason).toBeUndefined();
    await outbox.discard(b.clientId);
    expect(await table.get(b.clientId)).toBeUndefined();
    expect(sent.map((s) => s.text)).toEqual(['a']);
    expect((await outbox.status()).state).toBe('sent');
  });
});

describe('a reload', () => {
  it('does not send a sent item twice', async () => {
    const first = build();
    first.outbox.start();
    const queued = await first.outbox.enqueue(note('once'));
    await first.outbox.settled();
    expect(first.sent).toHaveLength(1);

    const { table } = first.reopen();
    const sent: string[] = [];
    const again = createOutbox<Note>({ table, page: fakePage(), sender: async (item) => void sent.push(item.clientId) });
    again.start();
    await again.settled();
    expect(sent).toEqual([]);
    expect((await table.get(queued.clientId))?.stage).toBe('sent');
  });

  it('sends a write that was queued but not sent, with the same client id', async () => {
    const first = build();
    first.page.setOnline(false);
    first.outbox.start();
    const queued = await first.outbox.enqueue(note('later'));

    const { table } = first.reopen();
    const sent: string[] = [];
    const again = createOutbox<Note>({ table, page: fakePage(), sender: async (item) => void sent.push(item.clientId) });
    again.start();
    await again.settled();
    expect(sent).toEqual([queued.clientId]);
  });

  it('tries again, with the same client id, a send the page was closed in the middle of', async () => {
    let called = false;
    const first = build({
      timeoutMs: 60_000,
      sender: () => {
        called = true;
        return new Promise<void>(() => undefined);
      },
    });
    first.outbox.start();
    const queued = await first.outbox.enqueue(note('midway'));
    await until(() => called, 'the send');
    expect((await first.table.get(queued.clientId))?.stage).toBe('sending');
    expect((await first.outbox.status()).line).toBe('Sending');

    const { table } = first.reopen();
    const sent: string[] = [];
    const again = createOutbox<Note>({ table, page: fakePage(), sender: async (item) => void sent.push(item.clientId) });
    again.start();
    await again.settled();
    expect(sent).toEqual([queued.clientId]);
  });
});

describe('the status for the screen', () => {
  it('is told to onStatus as it changes, once for each change', async () => {
    const { outbox, statuses, page } = build();
    page.setOnline(false);
    outbox.start();
    await outbox.enqueue(note('x'));
    await outbox.settled();
    page.setOnline(true);
    await outbox.settled();
    expect(statuses.map((s) => s.line)).toEqual(['Waiting for the network', 'Sending', 'Sent']);
  });

  it('is idle with no line when the queue is empty, and a sent item is forgotten after a while', async () => {
    const { outbox, table } = build({ keepSentMs: 60_000 });
    outbox.start();
    expect(await outbox.status()).toMatchObject({ state: 'idle', line: '' });
    await outbox.enqueue(note('x'));
    await outbox.settled();
    expect((await outbox.status()).state).toBe('sent');
    await vi.advanceTimersByTimeAsync(60_000);
    await outbox.settled();
    expect(await table.count()).toBe(0);
    expect((await outbox.status()).state).toBe('idle');
  });

  it('puts a failure before everything else, and counts', async () => {
    const { outbox } = build({
      sender: async (item) => {
        if (item.payload.text === 'bad') throw new PermanentSendError('Nope.');
      },
    });
    outbox.start();
    await outbox.enqueue(note('bad'));
    await outbox.enqueue(note('ok'));
    await outbox.settled();
    expect(await outbox.status()).toMatchObject({ state: 'failed', failed: 1, sent: 1, waiting: 0, reason: 'Nope.' });
  });

  it('uses the app\'s words where it gives them', async () => {
    const { outbox, page } = build({ words: { waitingForNetwork: 'Offline: it will go later' } });
    page.setOnline(false);
    outbox.start();
    await outbox.enqueue(note('x'));
    await outbox.settled();
    expect((await outbox.status()).line).toBe('Offline: it will go later');
  });

  it('says what one item stands at', async () => {
    const { outbox, table } = build({ sender: async () => { throw new PermanentSendError('Too big.'); } });
    outbox.start();
    const queued = await outbox.enqueue(note('x'));
    await outbox.settled();
    const item = (await table.get(queued.clientId)) as OutboxItem<Note>;
    expect(outbox.itemStatus(item)).toEqual({ state: 'failed', line: 'Could not send: Too big.' });
  });
});

describe('stopping', () => {
  it('sends nothing more once stopped, and leaves the item to be sent after a restart', async () => {
    const { outbox, sent, page } = build();
    page.setOnline(false);
    const stop = outbox.start();
    await outbox.enqueue(note('x'));
    stop();
    page.setOnline(true);
    await outbox.settled();
    expect(sent).toEqual([]);
    outbox.start();
    await outbox.settled();
    expect(sent).toHaveLength(1);
  });
});
