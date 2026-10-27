import { describe, expect, it } from 'vitest';
import { FINAL_STATUSES, REQUEST_STATUSES, applyUpdates, isFinal, moved, statusLine, type RequestRecord, type StatusUpdate } from '../src/index.js';

const record = (over: Partial<RequestRecord> = {}): RequestRecord => ({
  id: 'direct:1',
  kind: 'tutor-ask',
  words: 'w',
  summary: 's',
  talkId: 't',
  who: 'ruth',
  sentAt: 1,
  day: '2026-10-26',
  status: 'filed',
  ...over,
});

describe('the vocabulary', () => {
  it('holds built-differently and moved', () => {
    expect(REQUEST_STATUSES).toContain('built-differently');
    expect(REQUEST_STATUSES).toContain('moved');
  });

  it('counts built-differently as final and moved as not', () => {
    expect(FINAL_STATUSES).toContain('built-differently');
    expect(FINAL_STATUSES).not.toContain('moved');
    expect(isFinal(record({ status: 'built-differently' }))).toBe(true);
    expect(isFinal(record({ status: 'moved' }))).toBe(false);
  });
});

describe('moved() with the new statuses', () => {
  it('keeps reason, bead, version, commit and url for built-differently', () => {
    const update: StatusUpdate = {
      request: 'direct:1', status: 'built-differently', ts: 5, bead: 'mw-9', reason: 'Done as a setting row', version: '2.1.0', commit: 'abc', url: 'https://example.com/c/1', setting: 'ignored',
    };
    expect(moved(record(), update)).toMatchObject({ status: 'built-differently', statusAt: 5, bead: 'mw-9', reason: 'Done as a setting row', version: '2.1.0', commit: 'abc', url: 'https://example.com/c/1' });
    expect(moved(record(), update).setting).toBeUndefined();
  });

  it('keeps reason and bead for moved, and nothing about a landing', () => {
    const next = moved(record(), { request: 'direct:1', status: 'moved', ts: 6, bead: 'mw-10', reason: 'Night mode', version: '9', commit: 'x', url: 'https://example.com' });
    expect(next).toMatchObject({ status: 'moved', bead: 'mw-10', reason: 'Night mode' });
    expect(next.version).toBeUndefined();
    expect(next.commit).toBeUndefined();
    expect(next.url).toBeUndefined();
  });

  it('drops a reason from the earlier status when the next one carries none', () => {
    const declined = record({ status: 'declined', reason: 'Not now', statusAt: 1 });
    expect(moved(declined, { request: 'direct:1', status: 'moved', ts: 2 }).reason).toBeUndefined();
  });

  it('a moved request is still open: a later update takes it on', () => {
    const { records } = applyUpdates([record({ status: 'moved', reason: 'Night mode', bead: 'mw-10', statusAt: 6 })], [{ request: 'direct:1', status: 'landed', ts: 7, version: '2.2.0' }]);
    expect(records[0]).toMatchObject({ status: 'landed', version: '2.2.0' });
    expect(records[0]?.bead).toBeUndefined();
    expect(records[0]?.reason).toBeUndefined();
  });
});

describe('statusLine with the new statuses', () => {
  it('says Built another way, with the note and the version when it has them', () => {
    expect(statusLine(record({ status: 'built-differently', reason: 'A setting row did it' }))).toBe('Built another way: A setting row did it');
    expect(statusLine(record({ status: 'built-differently', reason: 'A setting row did it', version: '2.1.0' }))).toBe('Built another way: A setting row did it in 2.1.0');
    expect(statusLine(record({ status: 'built-differently' }))).toBe('Built another way');
    expect(statusLine(record({ status: 'built-differently', version: '2.1.0' }))).toBe('Built another way in 2.1.0');
  });

  it('says Now part of the title, or of another story with none', () => {
    expect(statusLine(record({ status: 'moved', reason: 'Night mode' }))).toBe('Now part of: Night mode');
    expect(statusLine(record({ status: 'moved' }))).toBe('Now part of another story');
  });

  it('still reads the older statuses as before', () => {
    expect(statusLine(record({ status: 'declined', reason: 'Not now' }))).toBe('Declined: Not now');
    expect(statusLine(record({ status: 'sent' }))).toBe('Sent');
  });
});
