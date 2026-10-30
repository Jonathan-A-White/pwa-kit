import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

describe('@pwa-kit/push', () => {
  it('exports the push surface', () => {
    expect(Object.keys(pkg).sort()).toEqual(['DEFAULT_WORDS', 'PushError', 'createPush', 'urlBase64ToBytes'].sort());
  });
});
