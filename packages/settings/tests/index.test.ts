import { describe, expect, it } from 'vitest';
import * as kit from '../src/index.js';

describe('the entry point', () => {
  it('exports the definition, the rows, the registry and the home', () => {
    expect(Object.keys(kit).sort()).toEqual(
      [
        'Found',
        'GroupButton',
        'MAX_CHANGES',
        'SettingsHome',
        'SettingsSearch',
        'TAP_TARGET',
        'TEXT_MAX',
        'createRegistry',
        'createSettingsStore',
        'defineSetting',
        'entryOf',
        'foldText',
        'groupOf',
        'groupProblems',
        'isAllowed',
        'neededFor',
        'rowsAt',
        'rowsInOrder',
        'searchSettings',
        'visibleGroups',
        'visibleRows',
      ].sort(),
    );
  });
});
