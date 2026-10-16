// tap imports only react and its own files; its package.json names react as the only, optional, peer; and the testing
// helper imports nothing from Playwright or testing-library (it types a page and a locator structurally).
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

describe('packages/tap', () => {
  it('has source to check', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'guard.ts', 'testing.ts']));
  });

  it('imports only react and its own files', () => {
    const specifiers = files.flatMap(specifiersOf);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s !== 'react' && !s.startsWith('./'))).toEqual([]);
    for (const s of specifiers.filter((x) => x.startsWith('./'))) {
      expect(files).toContain(s.replace(/^\.\//, '').replace(/\.js$/, '.ts'));
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

  it('keeps src/testing.ts free of Playwright, testing-library and react', () => {
    expect(specifiersOf('testing.ts').filter((s) => /playwright|testing-library|react/.test(s))).toEqual([]);
  });

  it('never reads the wall clock', () => {
    for (const f of files) expect(read(f)).not.toContain('Date.now');
  });
});
