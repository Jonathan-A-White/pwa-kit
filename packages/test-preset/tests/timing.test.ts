// MW_TIMING: skip the timing tests (a loaded host's gate), run only them, or both as given.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playwrightTimingFilter, timingFilter } from '../src/timing.js';

const GLOBS = 'tests/timing/**,**/*.timing.test.ts';
const globs = ['tests/timing/**', '**/*.timing.test.ts'];
const include = ['tests/**/*.test.ts'];
const exclude = ['tests/e2e/**'];

afterEach(() => vi.restoreAllMocks());

describe('timingFilter', () => {
  it('returns include and exclude as given with MW_TIMING unset', () => {
    expect(timingFilter({ include, exclude, env: {} })).toEqual({ include, exclude });
  });

  it('defaults exclude to none', () => {
    expect(timingFilter({ include, env: {} })).toEqual({ include, exclude: [] });
  });

  it('adds the MW_TIMING_TESTS globs to exclude with MW_TIMING=skip', () => {
    const f = timingFilter({ include, exclude, env: { MW_TIMING: 'skip', MW_TIMING_TESTS: GLOBS } });
    expect(f.include).toEqual(include);
    expect(f.exclude).toEqual([...exclude, ...globs]);
  });

  it('makes include exactly the globs with MW_TIMING=only', () => {
    const f = timingFilter({ include, exclude, env: { MW_TIMING: 'only', MW_TIMING_TESTS: GLOBS } });
    expect(f.include).toEqual(globs);
    expect(f.exclude).toEqual(exclude);
  });

  it('trims the globs and drops empty ones', () => {
    const f = timingFilter({ include, env: { MW_TIMING: 'only', MW_TIMING_TESTS: ' a/** , ,b/** ,' } });
    expect(f.include).toEqual(['a/**', 'b/**']);
  });

  it('reads any other value as unset and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = timingFilter({ include, exclude, env: { MW_TIMING: 'bogus', MW_TIMING_TESTS: GLOBS } });
    expect(f).toEqual({ include, exclude });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('bogus');
  });

  it('does not warn for an unset or an empty MW_TIMING', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    timingFilter({ include, env: {} });
    timingFilter({ include, env: { MW_TIMING: '' } });
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads skip or only with no MW_TIMING_TESTS as unset and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(timingFilter({ include, exclude, env: { MW_TIMING: 'only' } })).toEqual({ include, exclude });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(timingFilter({ include, exclude, env: { MW_TIMING: 'skip', MW_TIMING_TESTS: ' , ' } })).toEqual({ include, exclude });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not change the arrays it was given', () => {
    const inc = [...include];
    const exc = [...exclude];
    timingFilter({ include: inc, exclude: exc, env: { MW_TIMING: 'skip', MW_TIMING_TESTS: GLOBS } });
    expect(inc).toEqual(include);
    expect(exc).toEqual(exclude);
  });

  it('reads process.env when no env is given', () => {
    vi.stubEnv('MW_TIMING', 'only');
    vi.stubEnv('MW_TIMING_TESTS', GLOBS);
    try {
      expect(timingFilter({ include }).include).toEqual(globs);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('playwrightTimingFilter', () => {
  const testMatch = ['**/*.e2e.ts'];
  const testIgnore = ['**/wip/**'];

  it('returns testMatch and testIgnore as given with MW_TIMING unset', () => {
    expect(playwrightTimingFilter({ testMatch, testIgnore, env: {} })).toEqual({ testMatch, testIgnore });
  });

  it('adds the globs to testIgnore with MW_TIMING=skip', () => {
    const f = playwrightTimingFilter({ testMatch, testIgnore, env: { MW_TIMING: 'skip', MW_TIMING_TESTS: GLOBS } });
    expect(f).toEqual({ testMatch, testIgnore: [...testIgnore, ...globs] });
  });

  it('makes testMatch exactly the globs with MW_TIMING=only', () => {
    const f = playwrightTimingFilter({ testMatch, testIgnore, env: { MW_TIMING: 'only', MW_TIMING_TESTS: GLOBS } });
    expect(f).toEqual({ testMatch: globs, testIgnore });
  });

  it('reads any other value as unset and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(playwrightTimingFilter({ testMatch, env: { MW_TIMING: 'bogus' } })).toEqual({ testMatch, testIgnore: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
