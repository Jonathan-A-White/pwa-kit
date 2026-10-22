// picture-viewer imports only react, react-dom and its own files, and its package.json names those two as the only peers.
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

describe('packages/picture-viewer', () => {
  it('has source to check', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'zoom.ts', 'PictureViewer.tsx', 'usePictureViewer.ts', 'savePicture.ts']));
  });

  it('imports only react, react-dom and its own files', () => {
    const specifiers = files.flatMap(specifiersOf);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s !== 'react' && s !== 'react-dom' && !s.startsWith('./'))).toEqual([]);
    for (const s of specifiers.filter((x) => x.startsWith('./'))) {
      const base = s.replace(/^\.\//, '').replace(/\.js$/, '');
      expect(files.some((f) => f === `${base}.ts` || f === `${base}.tsx`)).toBe(true);
    }
  });

  it('declares react and react-dom as its only peer dependencies, and no Tailwind or other styling package', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Record<string, Record<string, unknown> | undefined>;
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      expect(Object.keys(pkg[k] ?? {})).toEqual([]);
    }
    expect(Object.keys(pkg.peerDependencies ?? {}).sort()).toEqual(['react', 'react-dom']);
  });

  it('draws with inline styles: no class names an app must have a stylesheet for', () => {
    expect(read('PictureViewer.tsx')).not.toMatch(/className\s*=/);
  });
});
