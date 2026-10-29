# @pwa-kit/test-preset

The timeouts a vitest or Playwright config takes so a test run survives a loaded host, a filter for the tests that
watch a real clock, and `settleAfterTeardown`. Plain data and functions: it imports nothing (vitest, Playwright and
testing-library are never imported; the app passes what it has), and it has no dependency.

<!-- toc -->

- [Install](#install)
- [Use](#use)
- [The numbers](#the-numbers)
- [MW_TIMING: the timing tests](#mw_timing-the-timing-tests)
- [settleAfterTeardown](#settleafterteardown)

<!-- /toc -->

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

Three lines in each config:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { timingFilter, vitestTimeouts } from 'pwa-kit/test-preset';

export default defineConfig({
  test: { ...vitestTimeouts, ...timingFilter({ include: ['tests/**/*.test.{ts,tsx}'], exclude: ['tests/e2e/**'] }) },
});
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { playwrightTimeouts, playwrightTimingFilter } from 'pwa-kit/test-preset';

export default defineConfig({ ...playwrightTimeouts, ...playwrightTimingFilter({ testMatch: ['**/*.e2e.ts'] }) });
```

```ts
// tests/setup.ts (vitest's setupFiles): findBy*, findAllBy* and waitFor wait this long
import { configure } from '@testing-library/dom';
import { ASYNC_WAIT_MS } from 'pwa-kit/test-preset';

configure({ asyncUtilTimeout: ASYNC_WAIT_MS });
```

A hook that builds, removes a build's output or spawns a process takes `HOOK_TIMEOUT_MS` as its last argument:
`afterAll(() => rmSync(dir, { recursive: true, force: true }), HOOK_TIMEOUT_MS)`.

**The rule:** a real-clock wait under the preset's budget (a `setTimeout`, a `waitForTimeout`) needs a reason in a comment
beside it. Everything else waits on what it is waiting for, or uses fake timers. A wait that is meant to be real goes
in the timing tests below.

## The numbers

| Name | Value | For |
| --- | --- | --- |
| `vitestTimeouts.testTimeout` | 40 000 ms | one test |
| `vitestTimeouts.hookTimeout` | 120 000 ms | a hook |
| `vitestTimeouts.expect.poll.timeout` | 20 000 ms | `expect.poll` |
| `ASYNC_WAIT_MS` | 10 000 ms | testing-library's `asyncUtilTimeout` |
| `HOOK_TIMEOUT_MS` | 120 000 ms | a hook that builds, removes a build or spawns |
| `playwrightTimeouts.timeout` | 60 000 ms | one Playwright test |
| `playwrightTimeouts.expect.timeout` | 20 000 ms | Playwright's `expect()` |

Each is marked PROVISIONAL in `src/timeouts.ts`, with where it came from (lampas and postern, on a host at load ~5).

## MW_TIMING: the timing tests

Tests that need a real clock go under globs listed once, in `MW_TIMING_TESTS`, comma-separated:

```bash
MW_TIMING_TESTS='tests/timing/**,**/*.timing.test.ts' MW_TIMING=skip npx vitest run   # everything but the timing tests
MW_TIMING_TESTS='tests/timing/**,**/*.timing.test.ts' MW_TIMING=only npx vitest run   # just them
```

With `MW_TIMING` unset, `timingFilter` returns `include` and `exclude` as given. `skip` adds the globs to `exclude`;
`only` makes `include` those globs alone. Any other value is read as unset, with one `console.warn`; so is `skip` or
`only` with no `MW_TIMING_TESTS` globs, so a missing variable never runs nothing. `playwrightTimingFilter` is the same
for `testMatch` and `testIgnore`.

## settleAfterTeardown

vitest removes jsdom's globals at the end of a test file; a React `setState` that runs after that throws
`window is not defined` as an unhandled rejection, which fails a green run. `settleAfterTeardown(settle)` takes `window`
away as teardown does, runs `settle` (resolve or reject the read a closed screen started), lets the callbacks run, puts
`window` back and returns every unhandled rejection or uncaught error they raised:

```ts
const answer = deferred<string>();
const { unmount } = render(<Screen answer={answer.promise} />);
unmount();
expect(await settleAfterTeardown(() => answer.resolve('late'))).toEqual([]); // [] for a screen that uses useAlive()
```
