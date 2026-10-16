// alive imports only react, which it declares as an optional peer (like whats-new).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter((f) => /\.tsx?$/.test(f));
const read = (f: string): string => readFileSync(join(srcDir, f), 'utf-8');

describe('packages/alive', () => {
  it('has source to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('imports only react', () => {
    const specifiers = files.flatMap((f) => [...read(f).matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s !== 'react')).toEqual([]);
  });

  it('declares react as its only, optional, peer dependency', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, Record<string, unknown> | undefined>;
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      expect(Object.keys(pkg[k] ?? {})).toEqual([]);
    }
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(['react']);
    expect(pkg.peerDependenciesMeta).toEqual({ react: { optional: true } });
  });
});
