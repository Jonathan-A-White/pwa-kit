import { describe, expect, it } from 'vitest';
import * as kit from '../src/index.js';

describe('the entry point', () => {
  it('exports the request flow, the expected asks, the status and the list', () => {
    expect(Object.keys(kit).sort()).toEqual(
      [
        'DEFAULT_KEY',
        'DEFAULT_PER_DAY',
        'DEFAULT_POLL_MS',
        'ExpectedAsksError',
        'FINAL_STATUSES',
        'GROWN_UP',
        'MAX_SUMMARY',
        'MAX_WORDS',
        'REQUEST_STATUSES',
        'RequestsList',
        'applyUpdates',
        'askRows',
        'budgetMessage',
        'budgetOf',
        'createJsonStore',
        'createRequests',
        'dayOf',
        'defineExpectedAsks',
        'expectedAsksFromJson',
        'expectedAsksToJson',
        'groupByWho',
        'isFinal',
        'moved',
        'statusLine',
        'watchStatuses',
        'webLink',
      ].sort(),
    );
  });
});
