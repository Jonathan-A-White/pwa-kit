// @vitest-environment jsdom
// Save: the name a saved picture gets, and the share sheet's answers when the phone's links do not download
// (lifted from Postern's tests/unit/savePicture.test.ts, mw-jtzpw0.7).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pictureName, savePicture } from '../src/savePicture.js';

const anchorDownload = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download') as PropertyDescriptor;

function shareSheetThat(share: (data: ShareData) => Promise<void>, canShare: (data: ShareData) => boolean = () => true): void {
  Reflect.deleteProperty(HTMLAnchorElement.prototype, 'download');
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
  vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) }));
}

afterEach(() => {
  Object.defineProperty(HTMLAnchorElement.prototype, 'download', anchorDownload);
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pictureName', () => {
  const day = new Date(2026, 9, 10, 0, 25); // the user's own day: local fields

  it('keeps the picture its own file name', () => {
    expect(pictureName('receipt.jpg', 'image/jpeg', day)).toBe('receipt.jpg');
  });

  it('names a nameless picture picture and the date, jpg unless its type says otherwise', () => {
    expect(pictureName(undefined, undefined, day)).toBe('picture-2026-10-10.jpg');
    expect(pictureName(undefined, 'image/jpeg', day)).toBe('picture-2026-10-10.jpg');
    expect(pictureName('', 'image/png', day)).toBe('picture-2026-10-10.png');
    expect(pictureName(undefined, 'image/webp', day)).toBe('picture-2026-10-10.webp');
  });

  it('takes the app\'s own word in front of the date', () => {
    expect(pictureName(undefined, 'image/gif', day, 'postern')).toBe('postern-2026-10-10.gif');
  });

  it('uses the local day, not the UTC one', () => {
    // 00:25 local on the 10th is still the 9th in UTC east of Greenwich; the name must say the 10th everywhere
    expect(pictureName(undefined, undefined, new Date(2026, 9, 10, 0, 25))).toContain('2026-10-10');
    expect(pictureName(undefined, undefined, new Date(2026, 9, 10, 23, 55))).toContain('2026-10-10');
  });
});

describe('savePicture', () => {
  it('downloads by a link under the picture\'s name where links download', async () => {
    const links: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      links.push({ href: this.href, download: this.download });
    });
    expect(await savePicture('blob:p', 'wall.png', 'image/png')).toEqual({ saved: 'downloaded', file: 'wall.png' });
    expect(links).toEqual([{ href: 'blob:p', download: 'wall.png' }]);
  });

  it('hands the picture to the share sheet where links do not download', async () => {
    const shared: ShareData[] = [];
    shareSheetThat(async (data) => void shared.push(data));
    expect(await savePicture('blob:p', 'wall.png', 'image/png')).toEqual({ saved: 'shared', file: 'wall.png' });
    expect(shared[0]?.files?.[0]?.name).toBe('wall.png');
  });

  it('backing out of the share sheet is not a failure', async () => {
    shareSheetThat(async () => {
      throw new DOMException('Share canceled', 'AbortError');
    });
    expect(await savePicture('blob:p', 'wall.png', 'image/png')).toEqual({ saved: 'cancelled', file: 'wall.png' });
  });

  it('a share sheet that refuses files, or fails, did not save it', async () => {
    shareSheetThat(async () => {}, () => false);
    expect((await savePicture('blob:p', 'wall.png', 'image/png')).saved).toBe('failed');
    shareSheetThat(async () => {
      throw new DOMException('Not allowed', 'NotAllowedError');
    });
    expect((await savePicture('blob:p', 'wall.png', 'image/png')).saved).toBe('failed');
  });

  it('neither a download nor a share sheet: failed', async () => {
    Reflect.deleteProperty(HTMLAnchorElement.prototype, 'download');
    expect((await savePicture('blob:p', 'wall.png', 'image/png')).saved).toBe('failed');
  });
});
