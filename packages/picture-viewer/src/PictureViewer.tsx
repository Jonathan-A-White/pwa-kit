// <PictureViewer>: a picture full screen, on the browser's top layer. It is a <dialog> opened with showModal(), so it sits above
// every z-index an app uses and the page beneath is inert, wherever in the tree it is drawn; no stylesheet is needed (inline
// styles) and nothing but React is imported. Pinch to zoom (one to six times), drag a zoomed picture around, double tap to zoom
// in and out, the wheel on a computer. Close, Escape and the dialog's own cancel call `onClose`; the viewer never touches
// history, so the app decides what Back does (see usePictureViewer, or the app's own Back). Save shows only when the app gives
// a `save`. Lifted from Postern's cockpit/ImageViewer.tsx.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { Saved } from './savePicture.js';
import { DOUBLE_TAP_SCALE, MIN_SCALE, clampPan, clampScale, distance, pinchScale, type Point } from './zoom.js';

/** A picture to show: the URL it is drawn by (an object URL or a data URL), its file name and its type, for Save. */
export interface ShownPicture {
  src: string;
  name?: string;
  /** The picture's type, for the extension of a nameless picture's saved file. */
  type?: string;
}

/** What the app does for Save: put the picture on the phone and say how (see `savePicture`). */
export type SaveFn = (src: string, name: string | undefined, type: string | undefined) => Promise<{ saved: Saved; file: string }>;

export interface PictureViewerProps extends ShownPicture {
  /** Close, Escape and the dialog's cancel call this once; the app takes the viewer away (unmounts it). */
  onClose: () => void;
  /** Shows a Save button when given. */
  save?: SaveFn;
  /** The dialog's name for a screen reader (`Picture`). */
  label?: string;
}

/** What the viewer says once Save was tapped; backing out of the share sheet says nothing. */
function saidAfter(saved: Saved, file: string): string {
  if (saved === 'downloaded') return `Saved ${file} to Downloads`;
  if (saved === 'shared') return `Shared ${file}`;
  if (saved === 'failed') return 'Could not save this picture';
  return '';
}

const dialogStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  padding: 0,
  border: 0,
  background: '#000',
  color: '#fff',
  overflow: 'hidden',
};
// the dialog's own display stays the browser's (none until open); the layout lives in this box
const columnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', width: '100%', height: '100%' };
const barStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  paddingTop: 'max(8px, env(safe-area-inset-top))',
};
const buttonStyle: CSSProperties = {
  flexShrink: 0,
  minHeight: 44,
  padding: '0 12px',
  border: 0,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  font: 'inherit',
  fontSize: 14,
  fontWeight: 500,
};
const nameStyle: CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, opacity: 0.8 };
const statusStyle: CSSProperties = { flexShrink: 0, margin: 0, fontSize: 13, opacity: 0.8 };
const surfaceStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  touchAction: 'none',
  userSelect: 'none',
  paddingBottom: 'env(safe-area-inset-bottom)',
};

export function PictureViewer({ src, name, type, onClose, save, label = 'Picture' }: PictureViewerProps) {
  const [view, setView] = useState({ scale: MIN_SCALE, x: 0, y: 0 });
  // Save: not tapped, under way, or what it did (and so dead, unless he backed out of the share sheet)
  const [saving, setSaving] = useState<{ state: 'idle' | 'saving' | Saved; said: string }>({ state: 'idle', said: '' });
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const fingers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; scale: number }>(undefined);
  const dragged = useRef<Point>(undefined);
  const mounted = useRef(true);
  const latestClose = useRef(onClose);
  const closing = useRef(false);

  useEffect(() => {
    latestClose.current = onClose;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // One close, however many ways say it at once (Escape is a keydown and then a cancel).
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    queueMicrotask(() => {
      closing.current = false;
    });
    latestClose.current();
  }, []);

  useEffect(() => {
    const box = dialog.current;
    if (!box) return;
    const opener = document.activeElement;
    // A browser without showModal still shows the dialog, open but not on the top layer.
    if (!box.open) {
      if (typeof box.showModal === 'function') box.showModal();
      else box.setAttribute('open', '');
    }
    closeButton.current?.focus({ preventScroll: true });
    // The browser's own close request (Escape, or Back on a phone that routes it here): the app, not the dialog, closes it.
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    // Closed by something else (a form method=dialog, a browser that would not wait): say so.
    const onClosed = () => requestClose();
    // Escape ends here, so a sheet beneath that listens for it does not close too.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };
    box.addEventListener('cancel', onCancel);
    box.addEventListener('close', onClosed);
    window.addEventListener('keydown', onKey, true);
    return () => {
      box.removeEventListener('cancel', onCancel);
      box.removeEventListener('close', onClosed);
      window.removeEventListener('keydown', onKey, true);
      if (box.open && typeof box.close === 'function') box.close();
      // focus goes back to what opened the viewer, if it is still there and nothing else has taken focus since
      const now = document.activeElement;
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected && (now === null || now === document.body)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [requestClose]);

  function extent(): Point {
    const box = surface.current;
    return { x: box?.clientWidth || window.innerWidth, y: box?.clientHeight || window.innerHeight };
  }

  /** A scale and where the picture sits at it; at its own size it sits in the middle. */
  function place(scale: number, x: number, y: number) {
    const size = extent();
    setView(scale <= MIN_SCALE ? { scale: MIN_SCALE, x: 0, y: 0 } : { scale, x: clampPan(x, scale, size.x), y: clampPan(y, scale, size.y) });
  }

  function twoFingers(): [Point, Point] | undefined {
    const [a, b] = Array.from(fingers.current.values());
    return a && b ? [a, b] : undefined;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const two = twoFingers();
    if (two) {
      pinch.current = { distance: distance(two[0], two[1]), scale: view.scale };
      dragged.current = undefined;
    } else {
      dragged.current = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!fingers.current.has(event.pointerId)) return;
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const two = twoFingers();
    if (two && pinch.current) {
      place(pinchScale(pinch.current.scale, pinch.current.distance, distance(two[0], two[1])), view.x, view.y);
      return;
    }
    if (dragged.current && view.scale > MIN_SCALE) {
      place(view.scale, view.x + event.clientX - dragged.current.x, view.y + event.clientY - dragged.current.y);
      dragged.current = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    fingers.current.delete(event.pointerId);
    pinch.current = undefined;
    // the finger left down carries on as a drag from where it is
    const [rest] = Array.from(fingers.current.values());
    dragged.current = rest;
  }

  function onSave() {
    if (!save) return;
    setSaving({ state: 'saving', said: '' });
    void save(src, name, type).then(({ saved, file }) => {
      if (mounted.current) setSaving({ state: saved === 'cancelled' ? 'idle' : saved, said: saidAfter(saved, file) });
    });
  }

  const saveLabel =
    saving.state === 'saving' ? 'Saving…' : saving.state === 'downloaded' || saving.state === 'shared' ? 'Saved' : saving.state === 'failed' ? 'Not saved' : 'Save';

  return (
    <dialog ref={dialog} aria-label={label} data-pwa-kit="picture-viewer" style={dialogStyle}>
      <div style={columnStyle}>
        <div style={barStyle}>
          <button ref={closeButton} type="button" aria-label="Close picture" style={buttonStyle} onClick={requestClose}>
            Close
          </button>
          <span style={nameStyle}>{name}</span>
          {save && (
            <button type="button" aria-label="Save picture" disabled={saving.state !== 'idle'} style={{ ...buttonStyle, opacity: saving.state === 'idle' ? 1 : 0.6 }} onClick={onSave}>
              {saveLabel}
            </button>
          )}
        </div>
        <p role="status" style={{ ...statusStyle, padding: saving.said ? '0 12px' : 0 }}>
          {saving.said}
        </p>
        <div
          ref={surface}
          data-testid="viewer-surface"
          style={surfaceStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={() => place(view.scale > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE, 0, 0)}
          onWheel={(event) => place(clampScale(view.scale * Math.exp(-event.deltaY * 0.002)), view.x, view.y)}
        >
          <img
            src={src}
            alt={`${name ?? 'Picture'} (full screen)`}
            draggable={false}
            data-testid="viewer-image"
            data-scale={view.scale}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          />
        </div>
      </div>
    </dialog>
  );
}
