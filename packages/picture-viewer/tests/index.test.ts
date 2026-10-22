import { describe, expect, it } from 'vitest';
import * as kit from '../src/index.js';

describe('the entry point', () => {
  it('exports the viewer, the hook, the save helper and the zoom arithmetic', () => {
    expect(Object.keys(kit).sort()).toEqual(
      ['DOUBLE_TAP_SCALE', 'MAX_SCALE', 'MIN_SCALE', 'PictureViewer', 'canDownload', 'clampPan', 'clampScale', 'distance', 'panLimit', 'pictureName', 'pinchScale', 'savePicture', 'usePictureViewer'].sort(),
    );
  });
});
