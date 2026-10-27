// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { GROWN_UP, RequestsList, groupByWho, statusLine, type RequestRecord } from '../src/index.js';

afterEach(cleanup);

const record = (id: string, who: string, sentAt: number, over: Partial<RequestRecord> = {}): RequestRecord => ({
  id,
  kind: 'tutor-ask',
  words: `words of ${id}`,
  summary: `summary of ${id}`,
  talkId: 't',
  who,
  sentAt,
  day: '2026-10-22',
  status: 'sent',
  ...over,
});

const RECORDS = [record('a', 'ruth', 1), record('b', GROWN_UP, 2), record('c', 'ruth', 3, { status: 'building' }), record('d', 'ben', 4)];

describe('groupByWho', () => {
  it('groups by who, the person with the newest request first, each group newest first', () => {
    expect(groupByWho(RECORDS).map((g) => [g.who, g.records.map((r) => r.id)])).toEqual([
      ['ben', ['d']],
      ['ruth', ['c', 'a']],
      [GROWN_UP, ['b']],
    ]);
  });

  it('follows an order the app names, with anyone else after', () => {
    expect(groupByWho(RECORDS, [GROWN_UP, 'ruth']).map((g) => g.who)).toEqual([GROWN_UP, 'ruth', 'ben']);
  });
});

describe('<RequestsList>', () => {
  it('draws a group for each person with their requests under their name', () => {
    render(<RequestsList records={RECORDS} names={{ [GROWN_UP]: 'A grown-up', ruth: 'Ruth' }} order={[GROWN_UP, 'ruth', 'ben']} />);
    const groups = [...document.querySelectorAll('[data-who]')] as HTMLElement[];
    expect(groups.map((g) => g.getAttribute('data-who'))).toEqual([GROWN_UP, 'ruth', 'ben']);
    expect(within(groups[0]!).getByRole('heading', { name: 'A grown-up' })).toBeTruthy();
    expect(within(groups[1]!).getByRole('heading', { name: 'Ruth' })).toBeTruthy();
    expect(within(groups[2]!).getByRole('heading', { name: 'ben' })).toBeTruthy();
    expect([...groups[1]!.querySelectorAll('li')].map((li) => li.getAttribute('data-request'))).toEqual(['c', 'a']);
  });

  it('says where each request stands, as a link to the commit when it landed with one', () => {
    render(
      <RequestsList
        records={[
          record('a', 'ruth', 1, { status: 'landed', version: '2.0.0', url: 'https://example.com/c/1' }),
          record('b', 'ruth', 2, { status: 'declined', reason: 'Not now' }),
          record('c', 'ruth', 3, { status: 'landed', version: '2.0.1', url: 'javascript:alert(1)' }),
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: 'Adopted in 2.0.0' });
    expect(link.getAttribute('href')).toBe('https://example.com/c/1');
    expect(screen.getByText('Declined: Not now')).toBeTruthy();
    expect(screen.getByText('Adopted in 2.0.1').closest('a')).toBeNull();
  });

  it('draws a row for built-differently and for moved', () => {
    render(
      <RequestsList
        records={[
          record('a', 'ruth', 1, { status: 'built-differently', reason: 'A setting row did it', version: '2.1.0', url: 'https://example.com/c/2' }),
          record('b', 'ruth', 2, { status: 'moved', reason: 'Night mode', bead: 'mw-10' }),
          record('c', 'ruth', 3, { status: 'moved' }),
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Built another way: A setting row did it in 2.1.0' }).getAttribute('href')).toBe('https://example.com/c/2');
    expect(screen.getByText('Now part of: Night mode')).toBeTruthy();
    expect(screen.getByText('Now part of another story')).toBeTruthy();
  });

  it('shows the tutor\'s summary, or the words when there is none', () => {
    render(<RequestsList records={[record('a', 'ruth', 1), record('b', 'ruth', 2, { summary: '' })]} />);
    expect(screen.getByText('summary of a')).toBeTruthy();
    expect(screen.getByText('words of b')).toBeTruthy();
  });

  it('says so, in the app\'s words, when nothing was asked', () => {
    render(<RequestsList records={[]} empty="Nothing asked yet." />);
    expect(screen.getByText('Nothing asked yet.')).toBeTruthy();
    expect(document.querySelector('[data-who]')).toBeNull();
  });
});

describe('statusLine', () => {
  it('names each status in plain words', () => {
    const line = (over: Partial<RequestRecord>) => statusLine(record('a', 'ruth', 1, over));
    expect(line({})).toBe('Sent');
    expect(line({ status: 'filed' })).toBe('Filed');
    expect(line({ status: 'building' })).toBe('Being built');
    expect(line({ status: 'landed' })).toBe('Adopted');
    expect(line({ status: 'adopted-as-setting', setting: 'Night mode' })).toBe('Now a setting: Night mode');
    expect(line({ status: 'declined' })).toBe('Declined');
  });
});
