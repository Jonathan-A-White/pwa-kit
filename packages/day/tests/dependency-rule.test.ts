// day stands alone: pwa-kit/day imports nothing and has no DOM; pwa-kit/day/eslint imports only ESLint's types, and
// ESLint is an optional peer, so an app that uses only the functions installs no ESLint for them.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const read = (f: string): string => readFileSync(join(srcDir, f), 'utf-8');
const specifiersOf = (f: string): string[] => [...read(f).matchAll(/^(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('packages/day', () => {
  it('has source to check', () => {
    expect(files).toEqual(expect.arrayContaining(['day.ts', 'eslint.ts', 'index.ts']));
  });

  it('imports only its own files, and eslint.ts only the types of eslint', () => {
    for (const f of files) {
      const outside = specifiersOf(f).filter((s) => !s.startsWith('./'));
      expect(outside, f).toEqual(f === 'eslint.ts' ? ['eslint'] : []);
    }
    expect(read('eslint.ts')).toMatch(/import type \{[^}]*\} from 'eslint'/);
    expect(read('eslint.ts')).not.toMatch(/^import (?!type)[^\n]*'eslint'/m);
  });

  it('the day functions (day.ts, index.ts) import nothing at all', () => {
    expect(specifiersOf('day.ts')).toEqual([]);
    expect(specifiersOf('index.ts')).toEqual(['./day.js']);
  });

  it('has no window, document, navigator or storage reference', () => {
    const hits = files.flatMap((f) =>
      [...read(f).matchAll(/\b(window|document|navigator|localStorage|sessionStorage|indexedDB|DOMException)\b/g)].map((m) => `${f}: ${m[1]}`),
    );
    expect(hits).toEqual([]);
  });

  it('declares no dependency but an optional peer on eslint', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, unknown>;
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      expect(Object.keys((pkg[k] as Record<string, string> | undefined) ?? {})).toEqual([]);
    }
    expect(Object.keys(pkg.peerDependencies as Record<string, string>)).toEqual(['eslint']);
    expect(pkg.peerDependenciesMeta).toEqual({ eslint: { optional: true } });
  });
});
