import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

describe('@pwa-kit/tips', () => {
  it('exports the tips namespace', () => {
    expect(Object.keys(pkg)).toEqual(['tips']);
    expect(pkg.tips.createTips).toBeTypeOf('function');
    expect(pkg.tips.TipsError).toBeTypeOf('function');
  });
});
