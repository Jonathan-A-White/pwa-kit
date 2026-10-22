# @pwa-kit/picture-viewer

A picture shown full screen in an installed web app, drawn on the browser's **top layer**: the viewer is a `<dialog>` opened
with `showModal()`, so it sits above every `z-index` the app uses (a fixed sheet at `z-index: 9999` included) and the screen
beneath is inert, wherever in the tree it is drawn. It was Postern's viewer; apps that show pictures in a conversation share
this one. React 18 or later (`react` and `react-dom`) is the peer dependency. It needs no stylesheet and no Tailwind: it draws
with inline styles and imports nothing but React.

What it does:

- Pinch to zoom, from the picture's own size to six times it; drag a zoomed picture around (never past its edge); double tap
  to zoom in (2.5 times) and the next double tap to zoom out; the wheel on a computer.
- **Close** (the button), **Escape**, and the dialog's own close request all call `onClose`, once. The viewer never touches the
  app's history: the app decides what Back does (see below).
- **Save** shows only when the app gives a `save`. `savePicture` is the one to give: it downloads where links download, else
  hands the picture to the share sheet.
- Focus goes to Close when it opens and back to what opened it when it goes; the rest of the page is inert while it is open.
- A browser without `showModal` still shows the dialog (open, but not on the top layer).

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

```tsx
import { PictureViewer, savePicture } from 'pwa-kit/picture-viewer';

{open && (
  <PictureViewer
    src={url}                 // an object URL or a data URL
    name="wall.png"           // optional: shown in the bar, the alt text and the saved file's name
    type="image/png"          // optional: the extension of a nameless picture's saved file
    onClose={() => setOpen(false)}
    save={savePicture}        // optional: leave it out and there is no Save button
  />
)}
```

Mount it only while the picture is open; unmounting closes the dialog and gives focus back. Draw it anywhere: inside a sheet, a
fixed bar or a scroller, the top layer lifts it out of their stacking and clipping.

`save` is `(src, name, type) => Promise<{ saved: 'downloaded' | 'shared' | 'cancelled' | 'failed'; file: string }>`.
`savePicture(src, name, type, prefix?)` names a nameless picture `<prefix>-<the user's own day>.<ext>` (`picture` by default);
an app that wants its own word wraps it: `save={(s, n, t) => savePicture(s, n, t, 'postern')}`.

## Back

The viewer does not push or pop history, so it never fights the app's own Back. It calls `onClose` for Close, Escape and the
dialog's close request; Back is the app's to wire, one of two ways.

**An app with no Back handling of its own** uses `usePictureViewer`, which is Postern's `useViewer`: opening pushes one history
entry at the same address, Back (the phone's too) pops it and closes the viewer, and `close` takes the entry off again so the
next Back is not swallowed.

```tsx
import { PictureViewer, savePicture, usePictureViewer } from 'pwa-kit/picture-viewer';

function Chat({ messages }) {
  const { shown, open, close } = usePictureViewer();
  return (
    <>
      {messages.map((m) => <img key={m.id} src={m.url} onClick={() => open({ src: m.url, name: m.name, type: m.type })} />)}
      {shown && <PictureViewer {...shown} onClose={close} save={savePicture} />}
    </>
  );
}
```

**An app that already has a Back stack** (Lampas's `useSheetBack` in `src/ui/sheetBack.ts`) makes the viewer one more Back step
of its own and passes the same close to both. A small wrapper calls the hook, because a hook cannot be called under a
condition:

```tsx
function BackedViewer({ picture, onClose }: { picture: ShownPicture; onClose: () => void }) {
  useSheetBack(onClose);                     // Back, from the phone or the browser, calls onClose
  return <PictureViewer {...picture} onClose={onClose} />; // Close and Escape call it too; the hook takes the entry off
}
```

Escape is handled once, at the window in the capture phase, and stopped there, so a sheet beneath that listens for Escape
later in the same phase or in the bubble phase does not also close. A listener the app added to `window` in the capture phase
*before* the viewer opened still runs first; give such a listener a guard for an open viewer (`document.querySelector('dialog[data-pwa-kit="picture-viewer"][open]')`).

On a phone, Chrome may deliver Back to an open modal dialog as its close request (`cancel`) rather than as history traversal.
Either way the app's `onClose` runs once and the app's own entry is taken off by its `close`, so the two routes end in the same
place.

## The top layer, and how it is tested

`<dialog>.showModal()` puts the dialog in the browser's top layer, above all page content whatever `z-index` it has. Tests
here run in jsdom, which has no `showModal` and no hit-testing, so the unit test opens the viewer from inside a fixed element at
`z-index: 9999` and asserts the dialog is open and modal (`:modal`); the real `document.elementFromPoint` at the viewport's centre
was checked by hand in headless Chromium (see the changelog); pwa-kit has no browser test runner.

## Exports

| Export | What it is |
| --- | --- |
| `PictureViewer` | the component; props `src`, `name?`, `type?`, `onClose`, `save?`, `label?` |
| `usePictureViewer()` | `{ shown, open, close }`, tied to the browser's history so Back closes the viewer |
| `savePicture`, `pictureName`, `canDownload` | Save: download or share sheet, the saved file's name, feature detection |
| `MIN_SCALE`, `MAX_SCALE`, `DOUBLE_TAP_SCALE`, `clampScale`, `pinchScale`, `panLimit`, `clampPan`, `distance` | the zoom arithmetic, pure |

Types: `PictureViewerProps`, `ShownPicture`, `SaveFn`, `Saved`, `Point`.
