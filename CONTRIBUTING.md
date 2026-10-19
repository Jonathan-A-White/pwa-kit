# Contributing to pwa-kit

pwa-kit is small TypeScript libraries for what an installed web app shows about itself (What's new and one-time
tips, lifted from [bsv-kit](https://github.com/Jonathan-A-White/bsv-kit)) and for testing such an app (timeouts for a loaded host,
a guard for a setState after an await, a shared tap guard, a launch gate that opens the app's store with a timeout) and for keeping the user's own calendar day, not the UTC day. It is MIT licensed. A change is welcome when it is small, has its test, and leaves the gate green.

## Build and test

Node 20 or later. From a clone:

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

All of it must pass before a change is proposed. `npm test` runs every package's tests (they need no network, apart from
`scripts/consumer-smoke.mjs`, which installs the repo into a scratch app and needs the network or a warm npm cache;
`PWA_KIT_SKIP_SMOKE=1` leaves it out offline) and the checks in `scripts/` (nothing personal in a tracked file, the
README's Credits).

## Layout

- `packages/whats-new`, `packages/tips`: one library each, with `src/`, `tests/`, a README and a CHANGELOG. Each builds to
  its own `dist/` (`tsconfig.build.json`); the root `package.json` maps the entry points (`pwa-kit/whats-new`,
  `pwa-kit/tips`, ...) onto those `dist/` folders, and `prepare` builds them on a git install.
- `scripts/`: `check-personal.mjs`, `credits.mjs` and `consumer-smoke.mjs`, each run by `npm test`.
- The root `tsconfig.json` typechecks tips, day and the scripts (whats-new, alive, tap, launch-gate and app-update have their own, with DOM and JSX); the lint config uses day's built rule (`packages/day/dist`, which `npm ci` builds before lint runs); whats-new has its own `tsconfig.json` (DOM and JSX), and
  `vitest.config.ts` aliases the entry points to source so the tests run without a build.

## Proposing a change

1. Open an issue, or a pull request with the reason in its first lines. One change is one purpose: a fix, a feature, a
   document. Two purposes are two pull requests.
2. Branch from `main`. Commit in small steps, each with a plain sentence saying what changed.
3. Make the gate pass, then open the pull request. CI runs the same lint, typecheck, test and build jobs on it.

## What a change must bring

- **A test first.** Write the failing test, then the code that makes it pass. Tests live in each package's `tests/`. A
  test is never weakened or deleted to make a change pass.
- **Behaviour kept, for what came from bsv-kit.** The libraries were lifted unchanged, and apps rely on their behaviour; a
  change that differs from it says why in its changelog line.
- **A credit, for a dependency.** A package, tool, font or data file added or removed changes its credit in the README in
  the same commit; the credits test checks this.
- **A changelog line.** A change to a package's behaviour adds an entry, newest first, to that package's `CHANGELOG.md`,
  with breaking changes first, and raises the package's version in its `package.json` and in `package-lock.json`.
- **Docs that match.** A new or changed call is in the package's README, with an example that runs.
- **The boundaries kept.** Each library stands alone: whats-new and tips import nothing from each other, and a
  dependency-rule test in each package says so. tips has no UI and no DOM; it reaches storage only through the one it is
  handed.
- **The names kept.** The `bk-` class names and `--bk-*` properties, and tips' default storage key `bsv-kit:tips:dismissed`,
  are historical (from bsv-kit) and apps depend on them; renaming one is a breaking change.
- **Nothing personal.** No host name, home-directory path or full public key in a tracked file outside
  `tests/fixtures/` (`npm run check:personal`, part of `npm test`).
- **Strict TypeScript and ESM.** Relative imports end in `.js`; lint forbids explicit `any`.

## Releases

A release is a version in the packages' `package.json`, an entry in each changed package's changelog, an entry in the
root [CHANGELOG.md](CHANGELOG.md), and an annotated tag `vX.Y.Z` on the commit. Apps install by tag or by full commit SHA
(`npm install github:Jonathan-A-White/pwa-kit#<tag or SHA>`), never by branch.
