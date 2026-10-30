// The consumer smoke test: installs pwa-kit the way an app does, `npm install git+file://<a fresh clone>`,
// into a scratch directory, and checks from there what a git install must deliver:
//   - the exports map names the eighteen entry points (and package.json), nothing else;
//   - 'pwa-kit/tips' imports, keeps a dismissal through an injected storage, and its import graph reaches no other
//     pwa-kit library;
//   - 'pwa-kit/whats-new' renders with the React the app installs, its styles.css is packed, and its import graph
//     reaches no other pwa-kit library;
//   - 'pwa-kit/test-preset' imports with no dependency and filters the timing tests as MW_TIMING asks;
//   - 'pwa-kit/alive' imports with the app's React and its import graph reaches no other pwa-kit library;
//   - 'pwa-kit/tap' guards a double tap with the app's React and 'pwa-kit/tap/testing' taps twice; neither reaches
//     another pwa-kit library;
//   - 'pwa-kit/day' keeps the user's own day and 'pwa-kit/day/eslint' reports the UTC day through ESLint's Linter; neither
//     reaches another pwa-kit library;
//   - 'pwa-kit/launch-gate' opens a store through openWithin and says Opening… with the app's React; its import graph
//     reaches no other pwa-kit library;
//   - 'pwa-kit/app-update' offers a waiting build, takes it over on apply and reloads once, with the app's React; its import
//     graph reaches no other pwa-kit library;
//   - 'pwa-kit/picture-viewer' renders a <dialog> with Close, Save only when given, with the app's React and React DOM; its
//     import graph reaches no other pwa-kit library;
//   - 'pwa-kit/settings' defines a setting, hides a detail whose setting is off, finds a row by an accent-free search and
//     renders the home with the app's React; its styles.css is packed and its import graph reaches no other pwa-kit library;
//   - 'pwa-kit/requests' files a request from a talk once a day, refuses past its budget, lists the expected asks as rows, takes a
//     status through a reader and renders the list grouped by who asked with the app's React; its import graph reaches no other
//     pwa-kit library;
//   - 'pwa-kit/push' subscribes through a fake push manager and a fake signer, posts the subscription once, reads on, says the
//     one plain line for a denied permission and unsubscribes; its import graph reaches no other pwa-kit library;
//   - 'pwa-kit/outbox' queues a write in a table first, sends it once the page is online with its client id, tries a failed send again
//     with the same client id, keeps a refused one as failed with its reason and says the status words; its import graph reaches no other
//     pwa-kit library.
// The "fresh clone" is the working tree as it stands (tracked and untracked files, minus what git ignores),
// committed into a scratch repository, so an edit not yet committed is smoke-tested too.
// Run: npm run smoke   (needs the network or a warm npm cache: the install runs the build with devDependencies)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'pwa-kit-smoke-'));
const run = (cmd, args, cwd, extra = {}) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...extra });

try {
  // 1. A fresh clone of the tree.
  const clone = join(scratch, 'clone');
  mkdirSync(clone);
  const files = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root).split('\0').filter(Boolean);
  for (const f of files) {
    if (!existsSync(join(root, f))) continue; // deleted in the working tree
    mkdirSync(dirname(join(clone, f)), { recursive: true });
    cpSync(join(root, f), join(clone, f));
  }
  const git = (...args) => run('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.invalid', ...args], clone);
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'smoke');

  // 2. An app's scratch directory that installs it.
  const app = join(scratch, 'app');
  mkdirSync(app);
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'smoke-app', private: true, type: 'module' }));
  console.log('installing pwa-kit from a fresh clone ...');
  run('npm', ['install', '--no-audit', '--no-fund', `git+file://${clone}`], app, { timeout: 480_000 });
  const installed = join(app, 'node_modules', 'pwa-kit');

  // The exports map names the eighteen entry points (and package.json), nothing else: no deep imports.
  const entries = Object.keys(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf-8')).exports).sort();
  const expected = [
    './alive',
    './app-update',
    './day',
    './day/eslint',
    './launch-gate',
    './outbox',
    './package.json',
    './picture-viewer',
    './push',
    './requests',
    './settings',
    './settings/styles.css',
    './tap',
    './tap/testing',
    './test-preset',
    './tips',
    './whats-new',
    './whats-new/styles.css',
  ];
  if (JSON.stringify(entries) !== JSON.stringify(expected)) throw new Error('exports: ' + entries.join(', '));
  console.log('the exports map names the eighteen entry points');

  // Each library stands alone: walk an installed entry point's import graph and fail on any other pwa-kit library.
  const specifier = /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const standsAlone = (entry) => {
    const seen = new Set();
    const walk = (file) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const m of readFileSync(file, 'utf-8').matchAll(specifier)) {
        const s = m[1] ?? m[2] ?? m[3];
        if (/^(@pwa-kit\/|pwa-kit\/)/.test(s)) throw new Error(`${relative(installed, file)} imports ${s}`);
        if (s.startsWith('.')) walk(resolve(dirname(file), s));
      }
    };
    walk(join(installed, entry));
  };

  // 3. 'pwa-kit/tips' resolves and keeps a dismissal through an injected storage.
  for (const file of ['index.js', 'tips.js']) {
    if (!existsSync(join(installed, 'packages/tips/dist', file))) throw new Error(`packages/tips/dist/${file} is not packed`);
  }
  standsAlone('packages/tips/dist/index.js');
  writeFileSync(
    join(app, 'tips.mjs'),
    `
import { tips } from 'pwa-kit/tips';

const data = new Map();
const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
const t = tips.createTips({ tips: [{ id: 'one', text: 'A tip.', event: 'opened' }], storage });
if ((await t.nextTip('opened'))?.id !== 'one') throw new Error('tip not shown');
await t.dismiss('one');
if ((await t.nextTip('opened')) !== null) throw new Error('tip shown after dismiss');
console.log('pwa-kit/tips imports');
`,
  );
  console.log(run('node', ['tips.mjs'], app).trim());

  // 3b. 'pwa-kit/test-preset' resolves, needs no install of its own, and filters as MW_TIMING asks.
  for (const file of ['index.js', 'timeouts.js', 'timing.js', 'teardown.js']) {
    if (!existsSync(join(installed, 'packages/test-preset/dist', file))) throw new Error(`packages/test-preset/dist/${file} is not packed`);
  }
  standsAlone('packages/test-preset/dist/index.js');
  writeFileSync(
    join(app, 'test-preset.mjs'),
    `
import { HOOK_TIMEOUT_MS, playwrightTimeouts, settleAfterTeardown, timingFilter, vitestTimeouts } from 'pwa-kit/test-preset';

if (vitestTimeouts.hookTimeout !== HOOK_TIMEOUT_MS || playwrightTimeouts.timeout < 60_000) throw new Error('timeouts');
const env = { MW_TIMING: 'only', MW_TIMING_TESTS: 'tests/timing/**' };
if (timingFilter({ include: ['tests/**'], env }).include[0] !== 'tests/timing/**') throw new Error('timing filter');
if ((await settleAfterTeardown(() => {})).length !== 0) throw new Error('settleAfterTeardown');
console.log('pwa-kit/test-preset imports');
`,
  );
  console.log(run('node', ['test-preset.mjs'], app).trim());

  // 4. 'pwa-kit/whats-new' with the React the app brings: it renders, its stylesheet is packed, and its import graph
  // reaches no other pwa-kit library.
  run('npm', ['install', '--no-audit', '--no-fund', 'react@19', 'react-dom@19'], app, { timeout: 480_000 });
  standsAlone('packages/whats-new/dist/index.js');
  writeFileSync(
    join(app, 'whats-new.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { WhatsNewList, summarise, versionLink } from 'pwa-kit/whats-new';

const entries = [
  { version: '0.5.9', date: '2026-10-09', story: 's', kind: 'new', text: 'Pin a message.' },
  { version: '0.5.9', date: '2026-10-09', story: 's', kind: 'fixed', text: 'No more jumping.' },
];
const html = renderToString(createElement(WhatsNewList, { entries }));
if (!html.includes('bk-whats-new') || !html.includes('Pin a message.') || !html.includes('0.5.9')) throw new Error('whats-new html: ' + html);
if (summarise(entries, '0.5.8')?.bannerText !== "0.5.9 \u00b7 1 new, 1 fixed \u00b7 What's new") throw new Error('summary');
if (versionLink({ repo: 'a/b', public: true, version: '0.5.9' }) !== 'https://github.com/a/b/blob/main/CHANGELOG.md#059') throw new Error('link');
const css = createRequire(import.meta.url).resolve('pwa-kit/whats-new/styles.css');
if (!existsSync(css)) throw new Error('styles.css is not packed');
console.log('pwa-kit/whats-new renders');
`,
  );
  console.log(run('node', ['whats-new.mjs'], app).trim());

  // 5. 'pwa-kit/alive' with the same React: the hook runs (renderToString runs no effects, so alive() is its first value).
  standsAlone('packages/alive/dist/index.js');
  writeFileSync(
    join(app, 'alive.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useAlive } from 'pwa-kit/alive';

const Probe = () => createElement('p', null, String(useAlive()()));
if (!renderToString(createElement(Probe)).includes('true')) throw new Error('useAlive');
console.log('pwa-kit/alive imports');
`,
  );
  console.log(run('node', ['alive.mjs'], app).trim());

  // 6. 'pwa-kit/tap' and 'pwa-kit/tap/testing' with the same React: the guard swallows a second call within settleMs, the
  // hook runs, and twoTapsAt clicks a locator's centre twice (a fake page stands in for Playwright's).
  for (const file of ['index.js', 'guard.js', 'testing.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/tap/dist', file))) throw new Error(`packages/tap/dist/${file} is not packed`);
  }
  standsAlone('packages/tap/dist/index.js');
  standsAlone('packages/tap/dist/testing.js');
  writeFileSync(
    join(app, 'tap.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createTapGuard, tapSettings, useSettled, useTapGuard } from 'pwa-kit/tap';
import { twoTaps, twoTapsAt } from 'pwa-kit/tap/testing';

let runs = 0;
const run = createTapGuard()(() => runs++);
run();
run();
if (runs !== 1 || tapSettings.ms !== 300) throw new Error('tap guard');
const Probe = () => {
  useTapGuard();
  return createElement('p', null, String(useSettled()()));
};
if (!renderToString(createElement(Probe)).includes('false')) throw new Error('useSettled');
const clicks = [];
const page = { mouse: { click: async (x, y) => void clicks.push([x, y]) } };
await twoTapsAt(page, { boundingBox: async () => ({ x: 0, y: 0, width: 10, height: 10 }) }, { gapMs: 1 });
if (JSON.stringify(clicks) !== '[[5,5],[5,5]]' || typeof twoTaps !== 'function') throw new Error('twoTapsAt');
console.log('pwa-kit/tap imports');
`,
  );
  console.log(run('node', ['tap.mjs'], app).trim());
  // 7. 'pwa-kit/day' and 'pwa-kit/day/eslint': the functions keep a calendar day through a DST change, and the rule runs in
  // ESLint's own Linter, from the eslint the app installs.
  for (const file of ['index.js', 'day.js', 'eslint.js', 'eslint.d.ts']) {
    if (!existsSync(join(installed, 'packages/day/dist', file))) throw new Error(`packages/day/dist/${file} is not packed`);
  }
  standsAlone('packages/day/dist/index.js');
  standsAlone('packages/day/dist/eslint.js');
  run('npm', ['install', '--no-audit', '--no-fund', 'eslint@9'], app, { timeout: 480_000 });
  writeFileSync(
    join(app, 'day.mjs'),
    `
import { Linter } from 'eslint';
import { addDays, dayStart, isDay, localDay } from 'pwa-kit/day';
import dayLint from 'pwa-kit/day/eslint';

if (localDay(new Date(2026, 9, 13, 22, 30)) !== '2026-10-13' || dayStart('2026-10-14').getDate() !== 14) throw new Error('day');
if (addDays('2026-10-31', 1) !== '2026-11-01' || addDays('2026-11-01', 1) !== '2026-11-02' || isDay('2026-02-30')) throw new Error('addDays');
try {
  dayStart('soon');
  throw new Error('a bad day did not throw');
} catch (e) {
  if (e.name !== 'DayError') throw e;
}
const linter = new Linter();
const report = (code) => linter.verify(code, [dayLint]).map((m) => m.ruleId);
if (report("const d = new Date().toISOString().slice(0, 10);").join() !== 'pwa-kit-day/no-utc-day') throw new Error('rule: slice');
if (report("const d = new Date('2026-10-14');").join() !== 'pwa-kit-day/no-utc-day') throw new Error('rule: new Date');
if (report("const d = new Date('2026-10-14T12:00:00Z').toISOString();").length !== 0) throw new Error('rule: false positive');
console.log('pwa-kit/day imports');
`,
  );
  console.log(run('node', ['day.mjs'], app).trim());

  // 8. 'pwa-kit/launch-gate' with the same React: openWithin resolves, aborts at the timeout, and the gate says Opening…
  // (renderToString runs no effects, so the first paint is the opening word).
  for (const file of ['index.js', 'openWithin.js', 'LaunchGate.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/launch-gate/dist', file))) throw new Error(`packages/launch-gate/dist/${file} is not packed`);
  }
  standsAlone('packages/launch-gate/dist/index.js');
  writeFileSync(
    join(app, 'launch-gate.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { LaunchGate, LaunchTimeout, openWithin } from 'pwa-kit/launch-gate';

if ((await openWithin(async () => 'db')) !== 'db') throw new Error('openWithin');
let seen;
const error = await openWithin((signal) => ((seen = signal), new Promise(() => {})), { timeoutMs: 20 }).catch((e) => e);
if (!(error instanceof LaunchTimeout) || !seen.aborted) throw new Error('timeout');
const html = renderToString(createElement(LaunchGate, { open: async () => 'db' }, () => createElement('p', null, 'app')));
if (!html.includes('bk-launch-gate') || !html.includes('Opening')) throw new Error('launch-gate html: ' + html);
console.log('pwa-kit/launch-gate imports');
`,
  );
  console.log(run('node', ['launch-gate.mjs'], app).trim());

  // 9. 'pwa-kit/app-update' with the same React: a waiting build is offered, apply posts SKIP_WAITING, and the controller
  // change reloads once (a fake container, registration and document stand in for the browser's).
  for (const file of ['index.js', 'appUpdate.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/app-update/dist', file))) throw new Error(`packages/app-update/dist/${file} is not packed`);
  }
  standsAlone('packages/app-update/dist/index.js');
  writeFileSync(
    join(app, 'app-update.mjs'),
    `
import { TAKE_OVER_PATIENCE_MS, applyUpdate, getUpdateState, startAppUpdates } from 'pwa-kit/app-update';

globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
const posted = [];
const waiting = { state: 'installed', postMessage: (m) => void posted.push(m), addEventListener() {} };
let changed = () => {};
const container = { controller: {}, addEventListener: (_t, l) => void (changed = l), removeEventListener() {} };
const registration = { waiting, installing: null, update: async () => {}, addEventListener() {}, removeEventListener() {} };
let reloads = 0;
const updates = startAppUpdates({ container, registration, reload: () => void reloads++ });
if (getUpdateState() !== 'ready' || typeof TAKE_OVER_PATIENCE_MS !== 'number') throw new Error('offer');
applyUpdate();
if (getUpdateState() !== 'updating' || posted[0]?.type !== 'SKIP_WAITING') throw new Error('apply');
changed();
changed();
if (reloads !== 1) throw new Error('reload: ' + reloads);
updates.stop();
if (getUpdateState() !== 'none') throw new Error('stop');
console.log('pwa-kit/app-update imports');
`,
  );
  console.log(run('node', ['app-update.mjs'], app).trim());

  // 10. 'pwa-kit/picture-viewer' with the same React: the viewer is a <dialog> with a Close button, Save shows only when the
  // app gives one (renderToString runs no effects, so showModal() is not called: the top layer is the browser's), and the
  // zoom arithmetic and the save helper are there.
  for (const file of ['index.js', 'PictureViewer.js', 'usePictureViewer.js', 'savePicture.js', 'zoom.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/picture-viewer/dist', file))) throw new Error(`packages/picture-viewer/dist/${file} is not packed`);
  }
  standsAlone('packages/picture-viewer/dist/index.js');
  writeFileSync(
    join(app, 'picture-viewer.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PictureViewer, pictureName, pinchScale, savePicture, usePictureViewer } from 'pwa-kit/picture-viewer';

const plain = renderToString(createElement(PictureViewer, { src: 'blob:a', name: 'wall.png', onClose() {} }));
if (!plain.includes('<dialog') || !plain.includes('Close picture') || !plain.includes('wall.png') || plain.includes('Save picture')) {
  throw new Error('picture-viewer html: ' + plain);
}
const saving = renderToString(createElement(PictureViewer, { src: 'blob:a', onClose() {}, save: savePicture }));
if (!saving.includes('Save picture')) throw new Error('picture-viewer save: ' + saving);
if (pinchScale(1, 100, 300) !== 3 || pictureName(undefined, 'image/png', new Date(2026, 9, 10), 'app') !== 'app-2026-10-10.png') throw new Error('zoom or name');
if (typeof usePictureViewer !== 'function') throw new Error('usePictureViewer');
console.log('pwa-kit/picture-viewer imports');
`,
  );
  console.log(run('node', ['picture-viewer.mjs'], app).trim());
  // 11. 'pwa-kit/settings' with the same React: a setting declared once, a row hidden while the setting it depends on is off and
  // named by neededFor, a search that folds accents, the registry over an injected storage, and the home rendered with a search
  // box and a group button; styles.css is packed.
  for (const file of ['index.js', 'define.js', 'rows.js', 'registry.js', 'SettingsHome.js', 'styles.css', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/settings/dist', file))) throw new Error(`packages/settings/dist/${file} is not packed`);
  }
  standsAlone('packages/settings/dist/index.js');
  writeFileSync(
    join(app, 'settings.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { SettingsHome, createRegistry, createSettingsStore, defineSetting, entryOf, neededFor, rowsInOrder, visibleRows } from 'pwa-kit/settings';

const sections = [{ id: 'look', title: 'Look' }, { id: 'sync', title: 'Sync' }];
const groups = [{ id: 'display', title: 'Display', hint: 'Theme.', sections: ['look'] }, { id: 'data', title: 'Your data', hint: 'Sync.', sections: ['sync'] }];
const onOff = { kind: 'choice', values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] };
const cafe = defineSetting({ key: 'cafe', default: 'off', allowed: onOff, section: 'look', label: 'Café mode', hint: 'Warmer colours.' });
const sync = defineSetting({ key: 'sync', default: 'off', allowed: onOff, section: 'sync', label: 'Sync', hint: 'On every device.' });
const often = defineSetting({ key: 'often', default: 'off', allowed: onOff, section: 'sync', label: 'How often', hint: 'Between syncs.', dependsOn: { key: 'sync', shown: (v) => v === 'on' } });
let threw = false;
try { defineSetting({ key: 'bad', default: 'maybe', allowed: onOff, section: 'look', label: 'Bad', hint: 'Bad.' }); } catch { threw = true; }
if (!threw) throw new Error('a default outside Allowed was accepted');
const rows = rowsInOrder(sections, [cafe, sync, often].map(({ key, label, hint, section, dependsOn }) => ({ key, label, hint, section, dependsOn })));
const off = { sync: 'off' };
if (visibleRows(rows, off, '').some((r) => r.key === 'often') || neededFor(rows, off, 'often')?.key !== 'sync') throw new Error('hide or neededFor');
if (visibleRows(rows, { sync: 'on' }, 'CAFE').map((r) => r.key).join() !== 'cafe') throw new Error('search folds accents');
const data = new Map();
const store = createSettingsStore({ read: (k) => data.get(k), write: (k, v) => void data.set(k, v) });
const registry = createRegistry([cafe, sync, often].map((d) => entryOf(d, store)));
const { applied } = await registry.applyChanges([{ key: 'cafe', value: 'on' }, { key: 'cafe', value: 'purple' }]);
if (applied.length !== 1 || data.get('cafe') !== 'on') throw new Error('registry');
const html = renderToString(createElement(SettingsHome, { rows, groups, values: off, onOpenGroup() {}, onOpenRow() {} }));
if (!html.includes('Search settings') || !html.includes('data-group="display"') || !html.includes('Your data')) throw new Error('settings html: ' + html);
console.log('pwa-kit/settings imports');
`,
  );
  console.log(run('node', ['settings.mjs'], app).trim());
  // 12. 'pwa-kit/requests' with the same React: a request filed from a talk and sent once, the same words again kept as one, the budget
  // refusing with a reason, the expected asks as rows, a status taken through the reader, and the list grouped by who asked.
  for (const file of ['index.js', 'request.js', 'expected.js', 'status.js', 'budget.js', 'RequestsList.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/requests/dist', file))) throw new Error(`packages/requests/dist/${file} is not packed`);
  }
  standsAlone('packages/requests/dist/index.js');
  writeFileSync(
    join(app, 'requests.mjs'),
    `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { GROWN_UP, RequestsList, askRows, createRequests, defineExpectedAsks } from 'pwa-kit/requests';

const rows = [];
const store = { all: () => rows, put(r) { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); } };
let sent = 0;
const send = async () => ({ id: 'direct:' + ++sent });
const reader = async (open) => open.map((r) => ({ request: r.id, status: 'filed', ts: 10 }));
const requests = createRequests({ send, store, appVersion: '1.0.0', perDay: 2, readStatuses: reader });
const ask = (words, who) => ({ talkId: 't1', words, who, kind: 'tutor-ask', askId: 'night' });
const first = await requests.fileFromTalk(ask('A night mode', 'ruth'));
const again = await requests.fileFromTalk(ask('a night  mode', 'ruth'));
if (first.outcome !== 'sent' || again.outcome !== 'duplicate' || sent !== 1) throw new Error('filing: ' + first.outcome + ' ' + again.outcome);
await requests.fileFromTalk(ask('Bigger text', GROWN_UP));
const refused = await requests.fileFromTalk(ask('Another thing', GROWN_UP));
if (refused.outcome !== 'refused' || refused.reason !== 'budget' || !refused.message) throw new Error('budget: ' + JSON.stringify(refused));
if ((await requests.refresh()).changed !== 2) throw new Error('status');
const list = await requests.list();
const asks = askRows(defineExpectedAsks([{ id: 'night', title: 'A night mode', kind: 'tutor-ask' }, { id: 'other', title: 'Something else', kind: 'tutor-ask' }]), list);
if (!asks[0].asked || asks[0].status !== 'filed' || asks[1].asked) throw new Error('rows: ' + JSON.stringify(asks));
const html = renderToString(createElement(RequestsList, { records: list, names: { ruth: 'Ruth' } }));
if (!html.includes('data-who="ruth"') || !html.includes('data-who="grown-up"') || !html.includes('Ruth') || !html.includes('Filed')) throw new Error('requests html: ' + html);
console.log('pwa-kit/requests imports');
`,
  );
  console.log(run('node', ['requests.mjs'], app).trim());
  // 13. 'pwa-kit/push' with a fake push manager, a fake permission and a fake signer: subscribed and posted once, status on, a denied
  // permission as a status with its plain line, and the removal on unsubscribe.
  for (const file of ['index.js', 'subscribe.js', 'words.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/push/dist', file))) throw new Error(`packages/push/dist/${file} is not packed`);
  }
  standsAlone('packages/push/dist/index.js');
  writeFileSync(
    join(app, 'push.mjs'),
    `
import { DEFAULT_WORDS, createPush } from 'pwa-kit/push';

const posts = [];
const signer = { fetch: async (path, init) => (posts.push(path + ' ' + (init?.method ?? 'GET')), { ok: true, status: 200, json: async () => ({}) }) };
let held = false;
const sub = { endpoint: 'https://push.example/1', toJSON: () => ({ endpoint: 'https://push.example/1', keys: {} }), unsubscribe: async () => ((held = false), true) };
const registration = { pushManager: { subscribe: async () => ((held = true), sub), getSubscription: async () => (held ? sub : null) } };
const vapid = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const make = (permission) => createPush({
  signer, publicKeyHex: '02' + 'ab'.repeat(32), vapidPublicKey: vapid, registration: async () => registration, supported: () => true,
  notification: { permission: 'default', requestPermission: async function () { return (this.permission = permission); } },
});
const push = make('granted');
await push.subscribe();
if (posts.join() !== '/push/subscribe POST' || (await push.status()).state !== 'on') throw new Error('subscribe: ' + posts.join());
await push.unsubscribe();
if (posts.join() !== '/push/subscribe POST,/push/unsubscribe POST' || (await push.status()).state !== 'off') throw new Error('unsubscribe: ' + posts.join());
const blocked = await make('denied').subscribe();
if (blocked.state !== 'denied' || blocked.line !== DEFAULT_WORDS.denied || posts.length !== 2) throw new Error('denied: ' + JSON.stringify(blocked));
console.log('pwa-kit/push imports');
`,
  );
  console.log(run('node', ['push.mjs'], app).trim());
  // 14. 'pwa-kit/outbox' with a table held in a Map, a fake page and a fake sender: queued offline and written first, sent when the page is
  // online with its client id, a failed try tried again with the same id after the wait, a refused one kept failed with its reason.
  for (const file of ['index.js', 'outbox.js', 'status.js', 'page.js', 'index.d.ts']) {
    if (!existsSync(join(installed, 'packages/outbox/dist', file))) throw new Error(`packages/outbox/dist/${file} is not packed`);
  }
  standsAlone('packages/outbox/dist/index.js');
  writeFileSync(
    join(app, 'outbox.mjs'),
    `
import { PermanentSendError, createOutbox } from 'pwa-kit/outbox';

const rows = new Map();
const table = {
  get: async (id) => rows.get(id),
  add: async (item) => void rows.set(item.clientId, item),
  put: async (item) => void rows.set(item.clientId, item),
  delete: async (id) => void rows.delete(id),
  toArray: async () => [...rows.values()],
};
let online = false;
const wakes = new Set();
const page = { isOnline: () => online, isVisible: () => true, subscribe: (w) => (wakes.add(w), () => wakes.delete(w)) };
const tries = [];
const lines = [];
const outbox = createOutbox({
  table,
  page,
  backoff: { baseMs: 20, maxMs: 40 },
  sender: async (item) => {
    tries.push(item.clientId + ':' + item.payload);
    if (item.payload === 'flaky' && tries.length === 1) throw new Error('Gateway down');
    if (item.payload === 'bad') throw new PermanentSendError('Too long.');
  },
  onStatus: (status) => void lines.push(status.line),
});
const stop = outbox.start();
await outbox.enqueue('flaky', { clientId: 'one' });
if (rows.get('one')?.stage !== 'waiting' || (await outbox.status()).line !== 'Waiting for the network') throw new Error('queued: ' + JSON.stringify([...rows.values()]));
online = true;
wakes.forEach((w) => w());
await new Promise((r) => setTimeout(r, 200));
await outbox.settled();
if (tries.join() !== 'one:flaky,one:flaky' || rows.get('one')?.stage !== 'sent') throw new Error('retry: ' + tries.join() + ' ' + JSON.stringify([...rows.values()]));
await outbox.enqueue('bad', { clientId: 'two' });
await outbox.settled();
const status = await outbox.status();
if (rows.get('two')?.stage !== 'failed' || status.line !== 'Could not send: Too long.') throw new Error('failed: ' + JSON.stringify(status));
if (!lines.includes('Sent') || !lines.includes('Waiting for the network')) throw new Error('lines: ' + lines.join('|'));
stop();
console.log('pwa-kit/outbox imports');
`,
  );
  console.log(run('node', ['outbox.mjs'], app).trim());
  console.log('consumer smoke test passed');
} catch (err) {
  console.error(String(err?.stderr ?? '') || err);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
