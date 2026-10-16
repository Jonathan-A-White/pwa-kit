// The numbers an app's vitest and Playwright configs take, sized for a loaded host. Plain data: this imports nothing,
// so the app passes them to the tools it has. Every number below is PROVISIONAL: it was measured in one app on one
// shared host and is kept until a loaded gate shows it too small (or the app shows it hides a real hang).

/**
 * What vitest's `test` options take: `test: { ...vitestTimeouts }`.
 * - testTimeout 40_000: CPU-bound unit tests (real @bsv/sdk signing) pass vitest's 5 s default on an idle host and
 *   outran it at load ~5 (lampas/postern, mw-yjxcw.12). It also stays well above ASYNC_WAIT_MS, so a step that waits
 *   that long for something that never comes fails on the missing element, not on the test's own clock (postern
 *   vitest.config.ts, mw-40qzg4.1). PROVISIONAL.
 * - hookTimeout 120_000: vitest's default is 10 s and a rmSync of two vite build dirs outran it at load ~5 and failed
 *   a whole run (lampas, mw-5r3p30.420). PROVISIONAL.
 * - expect.poll.timeout 20_000: `expect.poll` waits 1 s unless told (postern, mw-40qzg4.1). PROVISIONAL.
 */
export const vitestTimeouts = {
  testTimeout: 40_000,
  hookTimeout: 120_000,
  expect: { poll: { timeout: 20_000 } },
};

/**
 * How long testing-library's findBy*, findAllBy* and waitFor wait before they give up: pass it as
 * `configure({ asyncUtilTimeout: ASYNC_WAIT_MS })` in the test setup file. Its own default is 1 s, which a loaded host
 * outruns (lampas tests/support/timeouts.ts). PROVISIONAL.
 */
export const ASYNC_WAIT_MS = 10_000;

/**
 * How long a hook that builds, removes a build's output or spawns a child process may take: give it as the hook's
 * last argument, `afterAll(() => rmSync(dir, { recursive: true, force: true }), HOOK_TIMEOUT_MS)`. The same number as
 * vitestTimeouts.hookTimeout, for a hook in a config that does not spread the preset (lampas, mw-5r3p30.420).
 * PROVISIONAL.
 */
export const HOOK_TIMEOUT_MS = 120_000;

/**
 * What Playwright's config takes: `defineConfig({ ...playwrightTimeouts, ... })`.
 * - timeout 60_000: a test against a preview build on a loaded host (postern playwright.config.ts). PROVISIONAL.
 * - expect.timeout 20_000: expect()'s own wait is 5 s unless told, and a loaded host outruns that (postern,
 *   mw-40qzg4.1). PROVISIONAL.
 */
export const playwrightTimeouts = {
  timeout: 60_000,
  expect: { timeout: 20_000 },
};
