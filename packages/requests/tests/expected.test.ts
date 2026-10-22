import { describe, expect, it } from 'vitest';
import { ExpectedAsksError, GROWN_UP, askRows, defineExpectedAsks, expectedAsksFromJson, expectedAsksToJson, type RequestRecord } from '../src/index.js';

const ASKS = [
  { id: 'night-mode', title: 'A night mode', kind: 'setting', opening: 'I would like a night mode ' },
  { id: 'new-text', title: 'Another text', kind: 'text' },
  { id: 'other-app', title: 'Work with another app', kind: 'tutor-ask', hint: 'Say which app.' },
] as const;

const record = (over: Partial<RequestRecord>): RequestRecord => ({
  id: 'direct:1',
  kind: 'setting',
  askId: 'night-mode',
  words: 'a night mode',
  summary: 'Night mode',
  talkId: 't',
  who: GROWN_UP,
  sentAt: 1,
  day: '2026-10-22',
  status: 'sent',
  ...over,
});

describe('the expected asks', () => {
  it('round-trips through JSON, in order, with only the fields it knows', () => {
    const list = defineExpectedAsks(ASKS);
    expect(list).toEqual(ASKS);
    expect(expectedAsksFromJson(expectedAsksToJson(list))).toEqual(list);
    expect(expectedAsksFromJson(JSON.stringify([{ id: 'a', title: 'A', kind: 'k', extra: 1 }]))).toEqual([{ id: 'a', title: 'A', kind: 'k' }]);
  });

  it('copies the list it is given, so a later edit of the source changes nothing', () => {
    const source = [{ id: 'a', title: 'A', kind: 'k' }];
    const list = defineExpectedAsks(source);
    source[0]!.title = 'changed';
    expect(list[0]?.title).toBe('A');
  });

  it('throws for an ask without an id, a title or a kind, and for two with one id', () => {
    expect(() => defineExpectedAsks([{ id: ' ', title: 'A', kind: 'k' }])).toThrow(ExpectedAsksError);
    expect(() => defineExpectedAsks([{ id: 'a', title: '', kind: 'k' }])).toThrow(/title/);
    expect(() => defineExpectedAsks([{ id: 'a', title: 'A', kind: '' }])).toThrow(/kind/);
    expect(() => defineExpectedAsks([ASKS[0], ASKS[0]])).toThrow(/night-mode/);
  });

  it('refuses JSON that is not a list of asks', () => {
    expect(() => expectedAsksFromJson('{"id":"a"}')).toThrow(ExpectedAsksError);
    expect(() => expectedAsksFromJson('not json')).toThrow(ExpectedAsksError);
    expect(() => expectedAsksFromJson('[{"id":"a","title":"A"}]')).toThrow(/kind/);
  });

  it('draws one row per ask, with the latest request made for it and what it opens a talk with', () => {
    const rows = askRows(defineExpectedAsks(ASKS), [
      record({ id: 'direct:1', sentAt: 1, status: 'filed' }),
      record({ id: 'direct:2', sentAt: 5, status: 'building' }),
      record({ id: 'direct:3', kind: 'text', askId: undefined, sentAt: 9 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['night-mode', 'new-text', 'other-app']);
    expect(rows[0]).toMatchObject({ title: 'A night mode', opening: 'I would like a night mode ', asked: true, status: 'building', requestId: 'direct:2' });
    expect(rows[1]).toMatchObject({ asked: false, opening: '' });
    expect(rows[1]?.status).toBeUndefined();
    expect(rows[2]).toMatchObject({ hint: 'Say which app.', asked: false });
  });
});
