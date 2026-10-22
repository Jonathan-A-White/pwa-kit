// settings imports only react and its own files, and its package.json names react as the only peer. No router, no storage library, no
// app: sections, groups, definitions and storage all come in as arguments.
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

describe('packages/settings', () => {
  it('has source to check', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'define.ts', 'rows.ts', 'registry.ts', 'SettingsHome.tsx']));
  });

  it('imports only react and its own files', () => {
    const specifiers = files.flatMap(specifiersOf);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s !== 'react' && !s.startsWith('./'))).toEqual([]);
    for (const s of specifiers.filter((x) => x.startsWith('./'))) {
      const base = s.replace(/^\.\//, '').replace(/\.js$/, '');
      expect(files.some((f) => f === `${base}.ts` || f === `${base}.tsx`)).toBe(true);
    }
  });

  it('declares react as its only peer dependency, and no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, Record<string, unknown> | undefined>;
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) expect(Object.keys(pkg[k] ?? {})).toEqual([]);
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(['react']);
  });

  it('keeps the browser\'s storage and address out of the logic', () => {
    for (const f of files) {
      expect(read(f), f).not.toMatch(/localStorage|indexedDB|location\.hash/);
    }
  });
});
