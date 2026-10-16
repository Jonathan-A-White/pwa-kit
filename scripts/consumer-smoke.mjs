// The consumer smoke test: installs pwa-kit the way an app does, `npm install git+file://<a fresh clone>`,
// into a scratch directory, and checks from there what a git install must deliver:
//   - the exports map names the four entry points (and package.json), nothing else;
//   - 'pwa-kit/tips' imports, keeps a dismissal through an injected storage, and its import graph reaches no other
//     pwa-kit library;
//   - 'pwa-kit/whats-new' renders with the React the app installs, its styles.css is packed, and its import graph
//     reaches no other pwa-kit library.
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

  // The exports map names the four entry points (and package.json), nothing else: no deep imports.
  const entries = Object.keys(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf-8')).exports).sort();
  const expected = ['./package.json', './tips', './whats-new', './whats-new/styles.css'];
  if (JSON.stringify(entries) !== JSON.stringify(expected)) throw new Error('exports: ' + entries.join(', '));
  console.log('the exports map names the four entry points');

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
  console.log('consumer smoke test passed');
} catch (err) {
  console.error(String(err?.stderr ?? '') || err);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
