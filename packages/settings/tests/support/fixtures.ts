// A neutral app's settings for the tests: a notes app with sections, groups and a few settings that depend on each other.
import { defineSetting, type SettingsGroup, type SettingsRow, type SettingsSection } from '../../src/index.js';

export type NotesSection = 'welcome' | 'look' | 'text' | 'sync' | 'advanced';
export type NotesGroup = 'display' | 'data' | 'developer';

export const SECTIONS: readonly SettingsSection<NotesSection>[] = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'look', title: 'Look' },
  { id: 'text', title: 'Text' },
  { id: 'sync', title: 'Sync', hint: 'Keeps your notes on every device.' },
  { id: 'advanced', title: 'Advanced' },
];

export const HOME_SECTIONS: readonly NotesSection[] = ['welcome'];

export const GROUPS: readonly SettingsGroup<NotesSection, NotesGroup>[] = [
  { id: 'display', title: 'Display', hint: 'Theme and text size.', sections: ['look', 'text'] },
  { id: 'data', title: 'Your data', hint: 'Sync and backups.', sections: ['sync'] },
  { id: 'developer', title: 'Developer', hint: 'For finding faults.', sections: ['advanced'] },
];

export const theme = defineSetting({
  key: 'theme',
  default: 'light',
  allowed: { kind: 'choice', values: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] },
  section: 'look' as NotesSection,
  label: 'Theme',
  hint: 'Light or dark.',
});

export const cafe = defineSetting({
  key: 'cafe',
  default: 'off',
  allowed: { kind: 'choice', values: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }] },
  section: 'look' as NotesSection,
  label: 'Café mode',
  hint: 'Warmer colours for reading late.',
  help: 'Turns the page **sepia**.\n\n- Easier on the eyes at night',
});

export const textSize = defineSetting({
  key: 'textSize',
  default: 16,
  parse: (raw) => (typeof raw === 'string' && Number.isFinite(Number(raw)) && Number(raw) >= 12 && Number(raw) <= 28 ? Number(raw) : 16),
  allowed: { kind: 'number', min: 12, max: 28, step: 2 },
  section: 'text' as NotesSection,
  label: 'Text size',
  hint: 'How big the words are.',
});

export const sync = defineSetting({
  key: 'sync',
  default: 'off',
  allowed: { kind: 'choice', values: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }] },
  section: 'sync' as NotesSection,
  label: 'Sync',
  hint: 'Keep your notes on every device.',
});

export const syncEvery = defineSetting({
  key: 'syncEvery',
  default: '15',
  allowed: { kind: 'choice', values: [{ value: '5', label: 'Every 5 minutes' }, { value: '15', label: 'Every 15 minutes' }] },
  section: 'sync' as NotesSection,
  label: 'How often',
  hint: 'Minutes between syncs.',
  dependsOn: { key: 'sync', shown: (value) => value === 'on' },
});

export const syncOnWifi = defineSetting({
  key: 'syncOnWifi',
  default: 'on',
  allowed: { kind: 'choice', values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] },
  section: 'sync' as NotesSection,
  label: 'Only on Wi-Fi',
  hint: 'Saves mobile data.',
  dependsOn: { key: 'syncEvery', shown: () => true },
});

export const DEFS = [theme, cafe, textSize, sync, syncEvery, syncOnWifi] as const;

/** Rows that are not settings: a link on the welcome section and the developer switch, found rather than set. */
export const EXTRA_ROWS: readonly SettingsRow<NotesSection>[] = [
  { key: 'link.tour', label: 'Take the tour', hint: 'A short walk round the app.', section: 'welcome' },
  {
    key: 'developer',
    label: 'Developer mode',
    hint: 'For finding faults.',
    section: 'advanced',
    dependsOn: { key: 'developerMode', shown: (value) => value === 'on' || value === 'off' },
  },
];

export const settingRow = (def: (typeof DEFS)[number]): SettingsRow<NotesSection> => ({
  key: def.key,
  label: def.label,
  hint: def.hint,
  help: def.help,
  section: def.section,
  dependsOn: def.dependsOn,
});
