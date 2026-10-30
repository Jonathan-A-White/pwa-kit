// push imports nothing: the signer, the permission, the service worker registration and the support check all come in as arguments,
// and its package.json names no dependency of any kind.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const read = (f: string): string => readFileSync(join(srcDir, f), 'utf-8');

describe('packages/push', () => {
  it('has source to check', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'subscribe.ts', 'words.ts']));
  });

  it('imports only its own files', () => {
    const specifiers = files.flatMap((f) => [...read(f).matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? ''));
    expect(specifiers.filter((s) => !s.startsWith('./'))).toEqual([]);
  });

  it('declares no dependency in its package.json', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, unknown>;
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      expect(Object.keys((pkg[k] as Record<string, string> | undefined) ?? {})).toEqual([]);
    }
  });

  it('keeps the browser\'s storage out of it and the wall clock', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/localStorage|sessionStorage|indexedDB|the wall clock|Date\.now/);
  });
});
