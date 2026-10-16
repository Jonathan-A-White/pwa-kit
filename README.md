# pwa-kit

What every installed web app shows about itself, for React web apps on a phone, and the test settings that go with such an app. Small TypeScript libraries; the first two
were lifted from [bsv-kit](https://github.com/Jonathan-A-White/bsv-kit), where they lived until 2026-10-16:

- `@pwa-kit/whats-new`: an app's What's new, from its `changelog.json`: the summary for an Update ready banner
  (`0.5.9 · 1 new, 2 fixed · What's new`), a sheet shown once after an update (never on a first install), the list of
  versions for Settings or About, a Check for updates button, and the link from the version to `CHANGELOG.md` on GitHub.
  A React package, themed by CSS custom properties. See [packages/whats-new](packages/whats-new/README.md).
- `@pwa-kit/tips`: a list of one-time tips, which one to show now, and dismissed for good through a storage the app
  injects. No UI and no DOM. See [packages/tips](packages/tips/README.md).
- `@pwa-kit/test-preset`: vitest and Playwright timeouts sized for a loaded host, the `MW_TIMING` filter for tests that
  watch a real clock, and `settleAfterTeardown`. Plain data and functions; it imports nothing. See
  [packages/test-preset](packages/test-preset/README.md).
- `@pwa-kit/alive`: `useAlive()`, a guard for a React `setState` that runs after an await. See
  [packages/alive](packages/alive/README.md).
- `@pwa-kit/tap`: a shared tap guard (a tap that opens, closes or moves the view swallows a second tap within 300 ms; a
  control just drawn ignores taps for 300 ms) with React hooks, and `pwa-kit/tap/testing`, a two-tap helper for jsdom and
  Playwright. See [packages/tap](packages/tap/README.md).

What belongs here: what an installed app tells the person about itself (its releases, its tips), with app-shell state
kept through storage the app hands in. Nothing here needs a key, a server or a browser API beyond `localStorage` and the
service worker's registration. Each library imports nothing from the other; a test in each says so.

What's new needs React 18 or later (`react`, `react-dom`) and alive and tap need `react` (tap's core, `createTapGuard`, and its testing helper need none); tips and test-preset need none. React
is an optional peer dependency, so an app that uses only tips or test-preset installs no React for them.

## Install

From GitHub, by full commit SHA (there is no registry and no tag yet); `prepare` builds the libraries on install. An app
pins a commit, never a branch:

```bash
npm install github:Jonathan-A-White/pwa-kit#c1ccd6aa6a596aa88c6d4866435b4301a23d8dd6
```

That commit is the first with whats-new and tips, pwa-kit 0.1.0 (whats-new 0.1.2, tips 0.2.0); test-preset and alive
come with pwa-kit 0.2.0 and tap with 0.3.0, so pin a later commit for them, by its full SHA, the same way.

npm 11 warns that `pwa-kit` has an install script (`prepare`, the build) not yet covered by `allowScripts`. Allow it
with `npm install-scripts approve pwa-kit`, which adds an entry to your `package.json` keyed by the install line, for
example:

```json
"allowScripts": { "github:Jonathan-A-White/pwa-kit#c1ccd6aa6a596aa88c6d4866435b4301a23d8dd6": true }
```

Check that `package-lock.json` resolves it as `git+https://github.com/Jonathan-A-White/pwa-kit.git#<the SHA>`, not
`git+ssh`, so a machine with no GitHub key installs it too.

### Moving from bsv-kit

The entry points keep their last segment, so the move is one word per import: `bsv-kit/whats-new` becomes
`pwa-kit/whats-new`, and the same for `whats-new/styles.css` and `tips`. Change any vitest alias or `vi.mock` path that
names them too. Nothing else changes: the `bk-` class names and `--bk-whats-new-*` properties keep their names
(historical, from bsv-kit; apps already theme them), and tips' default storage key stays `bsv-kit:tips:dismissed`, so
a tip an app's user already dismissed stays dismissed.

## Examples

`pwa-kit/whats-new` and its stylesheet: the sheet shown once after an update, and the versions list in About.

```tsx
import { WhatsNewSheet, WhatsNewList, CheckForUpdates, useChangelog } from 'pwa-kit/whats-new';
import 'pwa-kit/whats-new/styles.css'; // its default look, themed by --bk-whats-new-* properties

export function About({ version }: { version: string }) {
  const entries = useChangelog(import.meta.env.BASE_URL); // reads <base>/changelog.json, null until loaded
  return (
    <>
      <WhatsNewSheet entries={entries} version={version} storageKey="myapp.lastSeenVersion" />
      <WhatsNewList entries={entries} />
      <CheckForUpdates />
    </>
  );
}
```

`pwa-kit/tips`: show each tip once, framework-free.

```ts
import { tips } from 'pwa-kit/tips';

const t = tips.createTips({
  tips: [{ id: 'long-press', text: 'Long-press a word to hear it.', event: 'reader-opened' }],
  storage: localStorage, // any { getItem, setItem }, sync or async
  key: 'myapp:tips', // optional: where the dismissed ids are kept
});

const tip = await t.nextTip('reader-opened'); // the first tip of that event not yet dismissed, or null
if (tip) {
  console.log(tip.text);
  await t.dismiss(tip.id); // dismissed for good
}
```

`pwa-kit/test-preset`: three lines in each config, and the timings an app's tests need on a loaded host.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { timingFilter, vitestTimeouts } from 'pwa-kit/test-preset';

export default defineConfig({
  test: { ...vitestTimeouts, ...timingFilter({ include: ['tests/**/*.test.ts'] }) }, // MW_TIMING=skip|only reads the rest
});

// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { playwrightTimeouts, playwrightTimingFilter } from 'pwa-kit/test-preset';

export default defineConfig({ ...playwrightTimeouts, ...playwrightTimingFilter({ testMatch: ['**/*.e2e.ts'] }) });

// tests/setup.ts: testing-library's findBy* and waitFor wait this long
import { configure } from '@testing-library/dom';
import { ASYNC_WAIT_MS } from 'pwa-kit/test-preset';
configure({ asyncUtilTimeout: ASYNC_WAIT_MS });
```

The rule that goes with it: a real-clock wait under the preset's budget (a `setTimeout`, a `waitForTimeout`) needs a
reason in a comment beside it. The rest of the tests wait on what they are waiting for, or use fake timers. See
[packages/test-preset](packages/test-preset/README.md).

`pwa-kit/alive`: a `setState` after an await that the screen has closed on.

```tsx
import { useAlive } from 'pwa-kit/alive';

function Profile({ url }: { url: string }) {
  const alive = useAlive();
  const [x, setX] = useState<string | null>(null);
  useEffect(() => {
    fetch(url).then((r) => r.text()).then((x) => { if (alive()) setX(x); });
  }, [url, alive]);
  return <p>{x}</p>;
}
```

`pwa-kit/tap`: a sheet that opens on a tap, its backdrop's close guarded, so the second tap of a double tap cannot close it;
and `pwa-kit/tap/testing` to prove it.

```tsx
import { useState } from 'react';
import { useTapGuard } from 'pwa-kit/tap';
import { twoTaps } from 'pwa-kit/tap/testing';

function Screen() {
  const guard = useTapGuard(); // one guard per screen, shared by the controls that change the view
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={guard(() => setOpen(true))}>Open</button>
      {open && <div data-testid="backdrop" onClick={guard(() => setOpen(false))}>Sheet</div>}
    </>
  );
}

// in a test (jsdom): the second tap lands on the backdrop 120 ms later, and is swallowed
await twoTaps(screen.getByText('Open'), () => screen.queryByTestId('backdrop'));
expect(screen.getByTestId('backdrop')).toBeTruthy();
// in Playwright: await twoTapsAt(page, page.getByRole('button', { name: 'Open' }));
```

## Modules

| Entry point | Exports | What it is |
| --- | --- | --- |
| `pwa-kit/whats-new` | `WhatsNewSheet`, `WhatsNewList`, `UpdateSummary`, `CheckForUpdates`, `useChangelog`, `summarise`, `versionLink`, ... | the app's What's new (React) |
| `pwa-kit/whats-new/styles.css` | | its default look |
| `pwa-kit/tips` | `tips` (`createTips`) | one-time tips, dismissed for good |
| `pwa-kit/test-preset` | `vitestTimeouts`, `ASYNC_WAIT_MS`, `HOOK_TIMEOUT_MS`, `playwrightTimeouts`, `timingFilter`, `playwrightTimingFilter`, `settleAfterTeardown` | test timeouts for a loaded host, the `MW_TIMING` filter |
| `pwa-kit/alive` | `useAlive` | a guard for a `setState` after an await (React) |
| `pwa-kit/tap` | `createTapGuard`, `useTapGuard`, `useSettled`, `tapSettings`, `TAP_SETTLE_MS` | a tap guard: a second tap within 300 ms is swallowed; a control just drawn ignores taps |
| `pwa-kit/tap/testing` | `twoTaps`, `twoTapsAt` | a double tap for jsdom and Playwright tests |

## Develop

Node 20 or later. See [CONTRIBUTING.md](CONTRIBUTING.md). The gate:

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

## Credits

> "If I have seen further it is by standing on the shoulders of Giants."
> Isaac Newton, letter to Robert Hooke, 1675

pwa-kit stands on the work below. Each credit gives what it is used for, its licence and any changes made. None of it is
changed by us: we use each as published.

A source added or removed changes its credit in the same commit, and the credits test says so: each credit ends with its
`Kind:` (package, tool, service, idea, font or data); a package credit fails when that package is no longer in a package.json,
and every bundled font or data file must be named in backticks by a font or data credit.

Runtime libraries the app brings (peer dependencies of `@pwa-kit/whats-new` only):

- [React](https://react.dev): `react` and `react-dom`, the UI library `@pwa-kit/whats-new` is written for (18 or later). Licence:
  [MIT](https://github.com/facebook/react/blob/main/LICENSE). No changes. Kind: package.

Tools used to build and test (not installed by apps):

- [TypeScript](https://github.com/microsoft/TypeScript): the language and compiler. Licence:
  [Apache-2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt). No changes. Kind: package.
- [Vitest](https://vitest.dev): runs the tests. Licence: [MIT](https://github.com/vitest-dev/vitest/blob/main/LICENSE). No changes. Kind: package.
- [ESLint](https://eslint.org): the linter. Licence: [MIT](https://github.com/eslint/eslint/blob/main/LICENSE). No changes. Kind: package.
- [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro): renders What's new in its
  tests. Licence: [MIT](https://github.com/testing-library/react-testing-library/blob/main/LICENSE). No changes. Kind: package.
- [@testing-library/dom](https://testing-library.com/docs/dom-testing-library/intro): finds what those tests
  render. Licence: [MIT](https://github.com/testing-library/dom-testing-library/blob/main/LICENSE). No changes. Kind: package.
- [jsdom](https://github.com/jsdom/jsdom): the page What's new's tests run in. Licence:
  [MIT](https://github.com/jsdom/jsdom/blob/main/LICENSE.txt). No changes. Kind: package.

Projects and ideas we took:

- [bsv-kit](https://github.com/Jonathan-A-White/bsv-kit): these two libraries, their tests and this repo's tooling lived there first and were
  moved here at one commit, named in each package's changelog. Licence: [MIT](https://github.com/Jonathan-A-White/bsv-kit/blob/main/LICENSE).
  Kind: idea.
- [Beads](https://github.com/steveyegge/beads): Steve Yegge's issue tracker for AI agents; the work on this repo is tracked in it.
  Licence: [MIT](https://github.com/steveyegge/beads/blob/main/LICENSE). Used as published. Kind: tool.
- [Gas Town](https://github.com/steveyegge/gastown): Steve Yegge's idea of a factory of coordinating agent roles, which shaped how
  this repo is built. Licence: [MIT](https://github.com/steveyegge/gastown/blob/main/LICENSE). We took the idea, not its code. Kind: idea.
- [Claude Code](https://www.anthropic.com/claude-code): Anthropic's coding agent, which writes the code in this repo under the
  Governor's direction. Licence: [commercial terms](https://www.anthropic.com/legal/commercial-terms). Used as a tool. Kind: tool.
