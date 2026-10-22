// Save in the picture viewer: the picture as it came, its own bytes and type at full size, onto the phone. A browser whose
// links download (an <a download>) saves it to Downloads, where the gallery finds it; only one that cannot hands the file to the
// share sheet (navigator.share), where Save Image puts it in Photos. Lifted from Postern's cockpit/savePicture.ts. The viewer
// shows Save only when the app passes this (or a save of its own) as its `save`.

/** What a tap on Save did: downloaded, shared, backed out of the share sheet, or neither could be done. */
export type Saved = 'downloaded' | 'shared' | 'cancelled' | 'failed';

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

const two = (n: number): string => String(n).padStart(2, '0');

/** The picture's own file name, or `<prefix>-<the user's own day>` with its type's extension (jpg when unknown). */
export function pictureName(name: string | undefined, type: string | undefined, now: Date = new Date(), prefix = 'picture'): string {
  if (name) return name;
  const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  return `${prefix}-${day}.${EXTENSIONS[type ?? ''] ?? 'jpg'}`;
}

/** Whether this browser's links download (feature detection: `download` on an <a>). */
export function canDownload(): boolean {
  return 'download' in HTMLAnchorElement.prototype;
}

function download(url: string, name: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.click();
}

/**
 * Saves the picture at the URL `src` (an object URL or a data URL): by download where links download, else by the share
 * sheet. Says what it did and the file name it saved under. `prefix` starts the name of a nameless picture (`picture`).
 */
export async function savePicture(
  src: string,
  name: string | undefined,
  type: string | undefined,
  prefix?: string,
): Promise<{ saved: Saved; file: string }> {
  const file = pictureName(name, type, new Date(), prefix);
  return { saved: await saveAs(src, file, type), file };
}

async function saveAs(src: string, file: string, type: string | undefined): Promise<Saved> {
  if (canDownload()) {
    download(src, file);
    return 'downloaded';
  }
  if (typeof navigator.share !== 'function') return 'failed';
  try {
    const blob = await (await fetch(src)).blob();
    const files = [new File([blob], file, { type: blob.type || type || 'image/jpeg' })];
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) return 'failed';
    await navigator.share({ files });
    return 'shared';
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
