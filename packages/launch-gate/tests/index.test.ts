// The entry point: what pwa-kit/launch-gate exports.
import { describe, expect, it } from 'vitest';
import * as launchGate from '../src/index.js';

describe('pwa-kit/launch-gate', () => {
  it('exports the gate, its default words, openWithin and LaunchTimeout', () => {
    expect(Object.keys(launchGate).sort()).toEqual(['DEFAULT_LAUNCH_WORDS', 'LaunchGate', 'LaunchTimeout', 'openWithin']);
  });
});
