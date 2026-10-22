# Changelog: @pwa-kit/picture-viewer

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-22)

- New: `PictureViewer`, `usePictureViewer`, `savePicture` and the zoom arithmetic, lifted from Postern's `ImageViewer.tsx`,
  `useViewer.ts`, `zoom.ts` and `savePicture.ts` (mw-t49ebj.1). Pinch (one to six times), drag, double tap, the wheel, Close,
  Escape and Back, and an optional Save, as in Postern.
- Changed from Postern: the viewer is a `<dialog>` opened with `showModal()`, so it is on the browser's top layer and no
  `z-index` of the app covers it (Postern's was `fixed z-[60]`, Lampas's `z-20` under Drill it's `z-40`). It draws with inline
  styles, not Tailwind, and imports only React. The history entry's key is `pictureViewer` (was `viewer`). A nameless
  picture's file is `<prefix>-<local day>.<ext>`, with `picture` as the default prefix (Postern's `postern`: pass
  `savePicture(s, n, t, 'postern')`), and the day is the user's own day, not the UTC one. Save is passed in (`save`), no longer
  built in; Close and Save are words, with no icon.
- Tests: Postern's pinch and double-tap scenarios, its zoom arithmetic and `savePicture.test.ts` moved; new for Escape, the
  dialog's cancel, Close, Save shown only when given, focus given back, and the top layer (the dialog opened from inside a fixed
  `z-index: 9999` box is open and modal).
- Checked by hand in headless Chromium (Playwright, a throwaway page, not part of the tests): with a fixed bar at
  `z-index: 99999` over the viewport's centre, `document.elementFromPoint` at the centre is the bar before the viewer opens and
  the viewer's picture after, inside a dialog that is open and `:modal`; focus is on Close; Escape removes the dialog.
