// Type-checks every package under packages/ without a hand-kept list: the root tsconfig.json run, then
// one tsc -p per package that has its own tsconfig.json. A package with .ts/.tsx sources that has no
// tsconfig.json must have every one of them in the root run, else this fails and names them, so a new
// package is never left unchecked. Run: npm run typecheck.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {{ name: string, dir: string, hasTsconfig: boolean, tsFiles: string[] }[]} packages
 * @param {Set<string>} rootFiles the files the root tsconfig.json run type-checks
 * @returns {{ name: string, files: string[] }[]} the packages with sources that no run covers
 */
export function findUncovered(packages, rootFiles) {
  return packages
    .filter((p) => !p.hasTsconfig)
    .map((p) => ({ name: p.name, files: p.tsFiles.filter((f) => !rootFiles.has(f)) }))
    .filter((p) => p.files.length > 0);
}

function sourcesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name === 'dist') return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourcesIn(path);
    return /\.tsx?$/.test(e.name) ? [path] : [];
  });
}

function tsc(args, options = {}) {
  return spawnSync(process.execPath, [fileURLToPath(import.meta.resolve('typescript/bin/tsc')), ...args], {
    encoding: 'utf8',
    ...options,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const packagesDir = join(base, 'packages');
  const packages = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dir = join(packagesDir, e.name);
      return { name: e.name, dir, hasTsconfig: existsSync(join(dir, 'tsconfig.json')), tsFiles: sourcesIn(dir) };
    });

  let failed = false;
  const listing = tsc(['-p', 'tsconfig.json', '--noEmit', '--listFilesOnly'], { cwd: base });
  const rootFiles = new Set(listing.stdout.split('\n').filter(Boolean));
  for (const u of findUncovered(packages, rootFiles)) {
    failed = true;
    console.error(`typecheck: packages/${u.name} has TypeScript the root tsconfig.json does not check and no tsconfig.json of its own:`);
    for (const f of u.files) console.error(`  ${f.slice(base.length + 1)}`);
  }

  const runs = ['tsconfig.json', ...packages.filter((p) => p.hasTsconfig).map((p) => join('packages', p.name, 'tsconfig.json'))];
  for (const project of runs) {
    const r = tsc(['-p', project, '--noEmit'], { cwd: base, stdio: 'inherit' });
    if (r.status !== 0) {
      failed = true;
      console.error(`typecheck: ${project} failed.`);
    }
  }
  if (failed) process.exit(1);
  console.log(`typecheck passed: ${runs.length} projects, ${packages.length} packages covered.`);
}
