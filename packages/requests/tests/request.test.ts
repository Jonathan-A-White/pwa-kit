import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEY, GROWN_UP, createJsonStore, createRequests, type MakerRequest, type RequestRecord, type RequestStore, type StatusUpdate } from '../src/index.js';

const DAY = new Date(2026, 9, 22, 9, 0, 0).getTime();
const HOUR = 3_600_000;

function memoryStore(): RequestStore & { rows: RequestRecord[] } {
  const rows: RequestRecord[] = [];
  return {
    rows,
    all: () => rows.map((r) => ({ ...r })),
    put(record) {
      const at = rows.findIndex((r) => r.id === record.id);
      if (at >= 0) rows[at] = { ...record };
      else rows.push({ ...record });
    },
  };
}

function setup(options: { perDay?: number; start?: number; readStatuses?: (open: readonly RequestRecord[]) => Promise<StatusUpdate[]> } = {}) {
  const store = memoryStore();
  let n = 0;
  const send = vi.fn<(request: MakerRequest) => Promise<{ id: string }>>(async () => ({ id: `direct:${++n}` }));
  let now = options.start ?? DAY;
  const requests = createRequests({
    send,
    store,
    appVersion: '1.2.3',
    now: () => now,
    ...(options.perDay === undefined ? {} : { perDay: options.perDay }),
    ...(options.readStatuses ? { readStatuses: options.readStatuses } : {}),
  });
  return { requests, send, store, advance: (ms: number) => (now += ms) };
}

const ask = (words: string, over: Partial<Parameters<ReturnType<typeof createRequests>['fileFromTalk']>[0]> = {}) => ({
  talkId: 'talk-1',
  words,
  who: GROWN_UP,
  kind: 'tutor-ask',
  ...over,
});

describe('fileFromTalk', () => {
  it('sends one request with the talk\'s words and who asked', async () => {
    const { requests, send, store } = setup();
    const result = await requests.fileFromTalk(ask('  I would like a night mode  ', { who: 'ruth' }));
    expect(result.outcome).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      kind: 'tutor-ask',
      text: 'I would like a night mode',
      summary: 'I would like a night mode',
      reference: 'talk-1',
      who: 'ruth',
      app_version: '1.2.3',
    });
    expect(store.rows).toEqual([
      expect.objectContaining({ id: 'direct:1', kind: 'tutor-ask', words: 'I would like a night mode', who: 'ruth', talkId: 'talk-1', status: 'sent', sentAt: DAY, day: '2026-10-22' }),
    ]);
  });

  it('sends the tutor\'s own summary when it gives one, and never a summary past 200 characters', async () => {
    const { requests, send } = setup();
    await requests.fileFromTalk(ask('a night mode', { summary: 'Night mode' }));
    expect(send.mock.calls[0]?.[0]).toMatchObject({ summary: 'Night mode' });
    await requests.fileFromTalk(ask('x'.repeat(500)));
    const second = send.mock.calls[1]?.[0] as { text: string; summary: string };
    expect(second.summary.length).toBeLessThanOrEqual(200);
    expect(second.text).toHaveLength(500);
  });

  it('files the same words twice in a day as one request, ignoring capitals, spacing and the minute', async () => {
    const { requests, send, store, advance } = setup();
    const first = await requests.fileFromTalk(ask('A night  mode'));
    advance(5 * HOUR);
    const again = await requests.fileFromTalk(ask('a night mode '));
    expect(again.outcome).toBe('duplicate');
    expect(again.outcome === 'duplicate' && again.record.id).toBe(first.outcome === 'sent' ? first.record.id : '');
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.rows).toHaveLength(1);
  });

  it('files two taps at once as one request', async () => {
    const { requests, send } = setup();
    const [a, b] = await Promise.all([requests.fileFromTalk(ask('a night mode')), requests.fileFromTalk(ask('a night mode'))]);
    expect([a.outcome, b.outcome].sort()).toEqual(['duplicate', 'sent']);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('files the same words again the next day, and from another person the same day', async () => {
    const { requests, send, advance } = setup();
    await requests.fileFromTalk(ask('a night mode'));
    const other = await requests.fileFromTalk(ask('a night mode', { who: 'ruth' }));
    expect(other.outcome).toBe('sent');
    advance(24 * HOUR);
    const next = await requests.fileFromTalk(ask('a night mode'));
    expect(next.outcome).toBe('sent');
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('refuses past the day\'s budget with a reason, sends nothing, and starts again the next day', async () => {
    const { requests, send, store, advance } = setup({ perDay: 2 });
    await requests.fileFromTalk(ask('one'));
    await requests.fileFromTalk(ask('two'));
    expect(await requests.budget()).toEqual({ limit: 2, used: 2, left: 0 });
    const refused = await requests.fileFromTalk(ask('three'));
    expect(refused).toMatchObject({ outcome: 'refused', reason: 'budget' });
    expect(refused.outcome === 'refused' && refused.message).toMatch(/2 requests a day/);
    expect(send).toHaveBeenCalledTimes(2);
    expect(store.rows).toHaveLength(2);
    advance(24 * HOUR);
    expect((await requests.fileFromTalk(ask('three'))).outcome).toBe('sent');
  });

  it('answers a repeat with the kept request even when the budget is spent', async () => {
    const { requests } = setup({ perDay: 1 });
    await requests.fileFromTalk(ask('one'));
    expect((await requests.fileFromTalk(ask('one'))).outcome).toBe('duplicate');
  });

  it('refuses empty words and words past the limit, sending nothing', async () => {
    const { requests, send } = setup();
    expect(await requests.fileFromTalk(ask('   '))).toMatchObject({ outcome: 'refused', reason: 'empty' });
    expect(await requests.fileFromTalk(ask('x'.repeat(4001)))).toMatchObject({ outcome: 'refused', reason: 'too-long' });
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps nothing and lets the failure through when the send fails, so the same words may be tried again', async () => {
    const { requests, send, store } = setup();
    send.mockRejectedValueOnce(new Error('offline'));
    await expect(requests.fileFromTalk(ask('a night mode'))).rejects.toThrow('offline');
    expect(store.rows).toEqual([]);
    expect((await requests.fileFromTalk(ask('a night mode'))).outcome).toBe('sent');
  });

  it('keeps the budget by the person\'s own day, not the UTC day', async () => {
    const lateEvening = new Date(2026, 9, 22, 23, 30, 0).getTime();
    const { requests, store, advance } = setup({ start: lateEvening, perDay: 1 });
    await requests.fileFromTalk(ask('one'));
    expect(store.rows[0]?.day).toBe('2026-10-22');
    advance(HOUR);
    expect((await requests.fileFromTalk(ask('two'))).outcome).toBe('sent');
    expect(store.rows[1]?.day).toBe('2026-10-23');
  });

  it('lists what was filed, the newest first', async () => {
    const { requests, advance } = setup();
    await requests.fileFromTalk(ask('one'));
    advance(1000);
    await requests.fileFromTalk(ask('two', { who: 'ruth' }));
    expect((await requests.list()).map((r) => r.words)).toEqual(['two', 'one']);
  });
});

describe('the status seen through the injected reader', () => {
  it('applies each update to the request it names, newest by time, and ignores a request it does not hold', async () => {
    const updates: StatusUpdate[][] = [
      [
        { request: 'direct:1', status: 'filed', ts: 10, bead: 'mw-1' },
        { request: 'direct:9', status: 'filed', ts: 10 },
      ],
      [
        { request: 'direct:1', status: 'landed', ts: 30, version: '2.0.0', url: 'https://example.com/c/1' },
        { request: 'direct:1', status: 'building', ts: 20 },
      ],
    ];
    const reader = vi.fn(async () => updates.shift() ?? []);
    const { requests } = setup({ readStatuses: reader });
    await requests.fileFromTalk(ask('one'));
    expect(await requests.refresh()).toEqual({ changed: 1 });
    expect((await requests.list())[0]).toMatchObject({ status: 'filed', bead: 'mw-1' });
    expect(await requests.refresh()).toEqual({ changed: 1 });
    expect((await requests.list())[0]).toMatchObject({ status: 'landed', version: '2.0.0', url: 'https://example.com/c/1' });
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('asks the reader about the requests still open only, and changes nothing without a reader', async () => {
    const reader = vi.fn(async (open: readonly RequestRecord[]) => open.map((r) => ({ request: r.id, status: 'declined' as const, ts: 5, reason: 'Not now' })));
    const { requests } = setup({ readStatuses: reader });
    await requests.fileFromTalk(ask('one'));
    await requests.refresh();
    await requests.refresh();
    expect(reader.mock.calls[0]?.[0]).toHaveLength(1);
    expect(reader.mock.calls[1]?.[0]).toHaveLength(0);
    const bare = setup();
    await bare.requests.fileFromTalk(ask('one'));
    expect(await bare.requests.refresh()).toEqual({ changed: 0 });
  });

  it('lets a reader\'s failure through and leaves what the store holds', async () => {
    const { requests } = setup({ readStatuses: async () => Promise.reject(new Error('backend down')) });
    await requests.fileFromTalk(ask('one'));
    await expect(requests.refresh()).rejects.toThrow('backend down');
    expect((await requests.list())[0]?.status).toBe('sent');
  });
});

describe('createJsonStore', () => {
  it('keeps the records as one JSON list in a key-value storage, replacing by id', async () => {
    const data = new Map<string, string>();
    const store = createJsonStore({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) });
    const row = (id: string, status: RequestRecord['status']): RequestRecord => ({ id, kind: 'k', words: 'w', summary: 's', talkId: 't', who: GROWN_UP, sentAt: 1, day: '2026-10-22', status });
    expect(await store.all()).toEqual([]);
    await store.put(row('a', 'sent'));
    await store.put(row('b', 'sent'));
    await store.put(row('a', 'filed'));
    expect((await store.all()).map((r) => [r.id, r.status])).toEqual([['a', 'filed'], ['b', 'sent']]);
    data.set(DEFAULT_KEY, '{"not":"a list"}');
    expect(await store.all()).toEqual([]);
    data.set(DEFAULT_KEY, 'not json');
    expect(await store.all()).toEqual([]);
  });
});
