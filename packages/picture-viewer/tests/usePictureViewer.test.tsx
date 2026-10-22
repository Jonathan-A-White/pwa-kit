// @vitest-environment jsdom
// usePictureViewer: which picture a screen has open, tied to the browser's history so Back closes it and leaves the screen
// beneath (Postern's useViewer, moved).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { usePictureViewer } from '../src/index.js';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

const popped = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
const picture = { src: 'blob:wall', name: 'wall.png' };

describe('usePictureViewer', () => {
  it('shows nothing until a picture is opened', () => {
    const { result } = renderHook(() => usePictureViewer());
    expect(result.current.shown).toBeUndefined();
  });

  it('opening pushes a history entry at the same address and shows the picture', () => {
    const before = window.history.length;
    const { result } = renderHook(() => usePictureViewer());
    act(() => result.current.open(picture));
    expect(result.current.shown).toEqual(picture);
    expect(window.history.length).toBe(before + 1);
    expect(window.location.pathname).toBe('/');
  });

  it('keeps what history.state already carried', () => {
    window.history.replaceState({ sheet: 1 }, '');
    const { result } = renderHook(() => usePictureViewer());
    act(() => result.current.open(picture));
    expect((window.history.state as { sheet?: number }).sheet).toBe(1);
  });

  it('Back closes it', async () => {
    const { result } = renderHook(() => usePictureViewer());
    act(() => result.current.open(picture));
    const gone = popped();
    act(() => window.history.back());
    await gone;
    await waitFor(() => expect(result.current.shown).toBeUndefined());
  });

  it('close() takes the entry it pushed off again, so the next Back is not swallowed', async () => {
    const { result } = renderHook(() => usePictureViewer());
    act(() => result.current.open(picture));
    const gone = popped();
    act(() => result.current.close());
    await gone;
    await waitFor(() => expect(result.current.shown).toBeUndefined());
    expect((window.history.state as { pictureViewer?: number } | null)?.pictureViewer).toBeUndefined();
  });

  it('close() when another entry is on top just closes it', () => {
    const { result } = renderHook(() => usePictureViewer());
    act(() => result.current.open(picture));
    act(() => window.history.pushState({}, '')); // the app moved on
    act(() => result.current.close());
    expect(result.current.shown).toBeUndefined();
  });

  it('opening a second picture while one is open replaces what is shown', () => {
    const { result } = renderHook(() => usePictureViewer());
    act(() => result.current.open(picture));
    act(() => result.current.open({ src: 'blob:other' }));
    expect(result.current.shown).toEqual({ src: 'blob:other' });
  });

  it('two viewers on a page do not close each other: Back to the other\'s entry leaves this one', async () => {
    const a = renderHook(() => usePictureViewer());
    const b = renderHook(() => usePictureViewer());
    act(() => a.result.current.open(picture));
    act(() => b.result.current.open({ src: 'blob:b' }));
    const gone = popped();
    act(() => window.history.back()); // pops b's entry: b closes, a stays
    await gone;
    await waitFor(() => expect(b.result.current.shown).toBeUndefined());
    expect(a.result.current.shown).toEqual(picture);
  });
});
