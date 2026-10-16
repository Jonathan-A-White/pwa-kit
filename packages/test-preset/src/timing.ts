// MW_TIMING: the tests that watch a real clock (timing tests) are listed once, as globs in MW_TIMING_TESTS, and a run
// chooses: MW_TIMING=skip leaves them out (a loaded host's gate), MW_TIMING=only runs just them, anything else runs
// everything as the app configured it. The globs are comma-separated: 'tests/timing/**,**/*.timing.test.ts'.

type Env = Record<string, string | undefined>;

type Mode = 'skip' | 'only' | null;

// The mode and globs the environment asks for; null mode when it asks for nothing usable (one console.warn if it
// asked wrongly).
function read(env: Env): { mode: Mode; globs: string[] } {
  const value = env.MW_TIMING;
  if (value === undefined || value === '') return { mode: null, globs: [] };
  if (value !== 'skip' && value !== 'only') {
    console.warn(`MW_TIMING=${value} is not 'skip' or 'only': read as unset, so every test runs.`);
    return { mode: null, globs: [] };
  }
  const globs = (env.MW_TIMING_TESTS ?? '').split(',').map((g) => g.trim()).filter(Boolean);
  if (globs.length === 0) {
    console.warn(`MW_TIMING=${value} but MW_TIMING_TESTS names no globs: read as unset, so every test runs.`);
    return { mode: null, globs: [] };
  }
  return { mode: value, globs };
}

/**
 * The include and exclude globs for vitest's `test` options, as MW_TIMING asks. With it unset, include and exclude
 * come back as given; `skip` adds the MW_TIMING_TESTS globs to exclude; `only` makes include those globs alone; any
 * other value is read as unset, with one console.warn. The arrays given are not changed.
 */
export function timingFilter(opts: { include: string[]; exclude?: string[]; env?: Env }): { include: string[]; exclude: string[] } {
  const { include, exclude = [], env = process.env } = opts;
  const { mode, globs } = read(env);
  if (mode === 'skip') return { include: [...include], exclude: [...exclude, ...globs] };
  if (mode === 'only') return { include: globs, exclude: [...exclude] };
  return { include: [...include], exclude: [...exclude] };
}

/** The same for Playwright's config: testMatch where timingFilter has include, testIgnore where it has exclude. */
export function playwrightTimingFilter(opts: { testMatch: string[]; testIgnore?: string[]; env?: Env }): {
  testMatch: string[];
  testIgnore: string[];
} {
  const { include, exclude } = timingFilter({ include: opts.testMatch, exclude: opts.testIgnore, env: opts.env });
  return { testMatch: include, testIgnore: exclude };
}
