// @vitest-environment jsdom
// <PictureViewer>: pinch, drag, double tap, the wheel, Close, Escape and the dialog's own cancel, an optional Save, focus
// kept inside and given back, and drawn on the top layer (a modal <dialog>). Postern's attachment-viewer scenarios, moved.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { PictureViewer } from '../src/index.js';
import { installShowModal } from './support/topLayer.js';

let restoreShowModal = () => {};
beforeEach(() => {
  restoreShowModal = installShowModal();
});
afterEach(() => {
  cleanup();
  restoreShowModal();
  vi.restoreAllMocks();
});

const surface = () => screen.getByTestId('viewer-surface');
const scale = () => Number(screen.getByTestId('viewer-image').getAttribute('data-scale'));
const at = (x: number, y = 200) => ({ clientX: x, clientY: y, bubbles: true });
const finger = (type: 'pointerdown' | 'pointermove' | 'pointerup', id: number, x: number, y = 200) =>
  fireEvent(surface(), new PointerEvent(type, { pointerId: id, ...at(x, y) }));
const imageMove = () => screen.getByTestId('viewer-image').style.transform;

function open(props: Partial<Parameters<typeof PictureViewer>[0]> = {}) {
  const onClose = vi.fn();
  render(<PictureViewer src="blob:wall" name="wall.png" onClose={onClose} {...props} />);
  return onClose;
}

describe('<PictureViewer> the picture', () => {
  it('shows the picture full screen, named, at its own size', () => {
    open();
    const image = screen.getByTestId('viewer-image') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('blob:wall');
    expect(image.alt).toBe('wall.png (full screen)');
    expect(scale()).toBe(1);
    expect(screen.getByText('wall.png')).toBeTruthy();
  });

  it('has a name for the dialog and a fallback alt for a nameless picture', () => {
    open({ name: undefined });
    expect((screen.getByTestId('viewer-image') as HTMLImageElement).alt).toBe('Picture (full screen)');
    expect(document.querySelector('dialog')?.getAttribute('aria-label')).toBe('Picture');
  });

  it('pinch: two fingers spread to 3 times, stop at 6 times, squeeze back to its own size', () => {
    open();
    finger('pointerdown', 1, 100);
    finger('pointerdown', 2, 200); // 100 apart
    finger('pointermove', 2, 400); // 300 apart
    expect(scale()).toBe(3);
    finger('pointermove', 2, 2100); // 2000 apart
    expect(scale()).toBe(6);
    finger('pointermove', 2, 110); // 10 apart
    expect(scale()).toBe(1);
  });

  it('double tap zooms in and the next one zooms back out', () => {
    open();
    fireEvent.doubleClick(surface());
    expect(scale()).toBe(2.5);
    fireEvent.doubleClick(surface());
    expect(scale()).toBe(1);
  });

  it('the wheel zooms, between the limits', () => {
    open();
    fireEvent.wheel(surface(), { deltaY: -100 });
    expect(scale()).toBeCloseTo(Math.exp(0.2), 5);
    fireEvent.wheel(surface(), { deltaY: -100000 });
    expect(scale()).toBe(6);
    fireEvent.wheel(surface(), { deltaY: 100000 });
    expect(scale()).toBe(1);
  });

  it('drag: a zoomed picture follows one finger but never past its overhang; a picture at its own size stays put', () => {
    open();
    finger('pointerdown', 1, 100);
    finger('pointermove', 1, 300);
    expect(imageMove()).toContain('translate(0px, 0px)');
    finger('pointerup', 1, 300);
    fireEvent.doubleClick(surface()); // 2.5 times; the surface is the window's size in jsdom (1024 x 768)
    finger('pointerdown', 1, 100);
    finger('pointermove', 1, 160);
    expect(imageMove()).toContain('translate(60px, 0px)');
    finger('pointermove', 1, 100 + 60 + 9999);
    expect(imageMove()).toContain(`translate(${(1024 * 1.5) / 2}px, 0px)`); // panLimit(2.5, 1024)
    finger('pointermove', 1, -99999);
    expect(imageMove()).toContain(`translate(${-(1024 * 1.5) / 2}px, 0px)`);
  });

  it('a pan stops being clamped to the old scale when zoomed back out: the picture is back in the middle', () => {
    open();
    fireEvent.doubleClick(surface());
    finger('pointerdown', 1, 100);
    finger('pointermove', 1, 300);
    fireEvent.doubleClick(surface());
    expect(imageMove()).toContain('translate(0px, 0px) scale(1)');
  });
});

describe('<PictureViewer> closing', () => {
  it('Close calls onClose once', () => {
    const onClose = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close picture' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onClose once, and does not reach a listener beneath it', () => {
    const onClose = open();
    const beneath = vi.fn();
    window.addEventListener('keydown', beneath);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    window.removeEventListener('keydown', beneath);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(beneath).not.toHaveBeenCalled();
  });

  it('another key does nothing', () => {
    const onClose = open();
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the dialog\'s own cancel (the browser\'s Escape, the phone\'s Back as a close request) calls onClose, and the app decides what closes', () => {
    const onClose = open();
    const cancel = new Event('cancel', { cancelable: true });
    document.querySelector('dialog')?.dispatchEvent(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true); // still there until the app unmounts it
  });

  it('a close the browser did on its own calls onClose', () => {
    const onClose = open();
    document.querySelector('dialog')?.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a keydown and a cancel of the same Escape call onClose once', () => {
    const onClose = open();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is gone from the page, and sends no close to onClose, when the app unmounts it', () => {
    const onClose = vi.fn();
    const { unmount } = render(<PictureViewer src="blob:wall" onClose={onClose} />);
    unmount();
    expect(document.querySelector('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses the latest onClose without reopening the dialog', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<PictureViewer src="blob:wall" onClose={first} />);
    const dialog = document.querySelector('dialog');
    rerender(<PictureViewer src="blob:wall" onClose={second} />);
    expect(document.querySelector('dialog')).toBe(dialog);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('runs under StrictMode (effects twice) with one open dialog and no stray close', () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <PictureViewer src="blob:wall" onClose={onClose} />
      </StrictMode>,
    );
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('<PictureViewer> Save', () => {
  it('has no Save unless the app gives one', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Save picture' })).toBeNull();
  });

  it('shows Save when given, and calls it with the picture, saying what it did', async () => {
    const save = vi.fn(async () => ({ saved: 'downloaded' as const, file: 'wall.png' }));
    open({ save, type: 'image/png' });
    const button = screen.getByRole('button', { name: 'Save picture' }) as HTMLButtonElement;
    expect(button.textContent).toBe('Save');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(save).toHaveBeenCalledWith('blob:wall', 'wall.png', 'image/png');
    expect(screen.getByRole('status').textContent).toBe('Saved wall.png to Downloads');
    expect(button.textContent).toBe('Saved');
    expect(button.disabled).toBe(true);
  });

  it('says Saving… while it works, and the share sheet\'s word when it shared', async () => {
    let finish: (v: { saved: 'shared'; file: string }) => void = () => {};
    const save = () => new Promise<{ saved: 'shared'; file: string }>((r) => (finish = r));
    open({ save });
    const button = screen.getByRole('button', { name: 'Save picture' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.textContent).toBe('Saving…');
    expect(button.disabled).toBe(true);
    await act(async () => finish({ saved: 'shared', file: 'wall.png' }));
    expect(screen.getByRole('status').textContent).toBe('Shared wall.png');
  });

  it('says it could not save, and leaves the button dead as Not saved', async () => {
    open({ save: async () => ({ saved: 'failed' as const, file: 'wall.png' }) });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));
    });
    expect(screen.getByRole('status').textContent).toBe('Could not save this picture');
    expect(screen.getByRole('button', { name: 'Save picture' }).textContent).toBe('Not saved');
  });

  it('backing out of the share sheet says nothing and lets him save again', async () => {
    open({ save: async () => ({ saved: 'cancelled' as const, file: 'wall.png' }) });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));
    });
    const button = screen.getByRole('button', { name: 'Save picture' }) as HTMLButtonElement;
    expect(screen.getByRole('status').textContent).toBe('');
    expect(button.textContent).toBe('Save');
    expect(button.disabled).toBe(false);
  });

  it('a save that finishes after the viewer is gone sets nothing (no warning)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let finish: (v: { saved: 'downloaded'; file: string }) => void = () => {};
    const { unmount } = render(<PictureViewer src="blob:wall" onClose={() => {}} save={() => new Promise((r) => (finish = r))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));
    unmount();
    await act(async () => finish({ saved: 'downloaded', file: 'x' }));
    expect(error).not.toHaveBeenCalled();
  });
});

describe('<PictureViewer> on the top layer', () => {
  // jsdom cannot hit-test (no layout, no document.elementFromPoint), so this asserts what puts an element on the top layer:
  // the viewer is a <dialog> that showModal() opened (open, and ':modal'), and it is a DOM descendant of the app's own
  // z-index 9999 box, which only the top layer can rise above. The real browser's elementFromPoint is checked by hand
  // (see the story's closing comment) since pwa-kit has no browser test runner.
  it('opens a modal dialog from inside a fixed element at z-index 9999', () => {
    render(
      <div data-testid="covering" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
        <PictureViewer src="blob:wall" onClose={() => {}} />
      </div>,
    );
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(screen.getByTestId('covering').contains(dialog)).toBe(true);
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    // no z-index of its own that would make it compete with the app's
    expect(dialog.style.zIndex).toBe('');
  });

  it('fills the screen: fixed, edge to edge, no browser margin, border or max size', () => {
    open();
    const { style } = document.querySelector('dialog') as HTMLDialogElement;
    expect([style.position, style.inset, style.width, style.height, style.maxWidth, style.maxHeight, style.margin, style.border]).toEqual([
      'fixed',
      '0px',
      '100%',
      '100%',
      'none',
      'none',
      '0px',
      '0px',
    ]);
  });

  it('on a browser with no showModal it still shows (open) rather than throwing', () => {
    restoreShowModal();
    expect(typeof HTMLDialogElement.prototype.showModal).toBe('undefined');
    open();
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });
});

describe('<PictureViewer> focus', () => {
  it('moves focus to Close when it opens and gives it back to what opened it when it goes', () => {
    function Screen() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button onClick={() => setShown(true)}>Open the picture</button>
          {shown && <PictureViewer src="blob:wall" onClose={() => setShown(false)} />}
        </>
      );
    }
    render(<Screen />);
    const opener = screen.getByRole('button', { name: 'Open the picture' });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close picture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close picture' }));
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('does not take focus back if he has moved on and something else has it', () => {
    function Screen() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button>Other</button>
          {shown && <PictureViewer src="blob:wall" onClose={() => setShown(false)} />}
          <button onClick={() => setShown(false)}>Elsewhere</button>
        </>
      );
    }
    render(<Screen />);
    // the viewer is closed from outside by a control that took focus first
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    fireEvent.click(elsewhere);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });
});
