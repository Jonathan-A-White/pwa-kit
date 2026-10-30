import { describe, expect, it } from 'vitest';
import * as kit from '../src/index.js';

describe('the entry point', () => {
  it('exports the definition, the rows, the registry and the home', () => {
    expect(Object.keys(kit).sort()).toEqual(
      [
        'Found',
        'GroupButton',
        'MAX_CHANGES',
        'SETTINGS_ROUTE',
        'SettingsHome',
        'SettingsSearch',
        'TAP_TARGET',
        'TEXT_MAX',
        'createConnections',
        'createRegistry',
        'createSettingsStore',
        'defineSetting',
        'entryOf',
        'foldText',
        'groupOf',
        'groupProblems',
        'isAllowed',
        'link',
        'neededFor',
        'rowsAt',
        'rowsInOrder',
        'searchSettings',
        'settingKeyOf',
        'visibleGroups',
        'visibleRows',
      ].sort(),
    );
  });
});
