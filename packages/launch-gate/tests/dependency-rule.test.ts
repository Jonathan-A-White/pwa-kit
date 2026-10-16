// launch-gate imports only react and its own files; its package.json names react as the only, optional, peer; and it never
// reads the wall clock (the phases come from timers alone).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter((f) => /\.tsx?$/.test(f));
const read = (f: string): string => readFileSync(join(srcDir, f), 'utf-8');
const specifiersOf = (f: string): string[] =>
  [...read(f).matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('packages/launch-gate', () => {
  it('has source to check', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'openWithin.ts', 'LaunchGate.tsx']));
  });

  it('imports only react and its own files', () => {
    const specifiers = files.flatMap(specifiersOf);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s !== 'react' && !s.startsWith('./'))).toEqual([]);
    for (const s of specifiers.filter((x) => x.startsWith('./'))) {
      expect(files).toContain(s.replace(/^\.\//, '').replace(/\.js$/, (m) => (files.includes(s.slice(2, -3) + '.tsx') ? '.tsx' : '.ts')));
    }
  });

  it('declares react as its only, optional, peer dependency', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, Record<string, unknown> | undefined>;
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      expect(Object.keys(pkg[k] ?? {})).toEqual([]);
    }
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(['react']);
    expect(pkg.peerDependenciesMeta).toEqual({ react: { optional: true } });
  });

  it('never reads the wall clock', () => {
    for (const f of files) expect(read(f)).not.toMatch(/Date\.now|performance\.now/);
  });

  it('has the openWithin core free of react', () => {
    expect(specifiersOf('openWithin.ts').filter((s) => s === 'react')).toEqual([]);
  });
});
