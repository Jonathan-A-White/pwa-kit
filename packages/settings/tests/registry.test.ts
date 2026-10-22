import { describe, expect, it, vi } from 'vitest';
import { createRegistry, createSettingsStore, entryOf, type SettingsStorage } from '../src/index.js';
import { DEFS, cafe, sync, textSize, theme } from './support/fixtures.js';

function memoryStorage(initial: Record<string, string> = {}): SettingsStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    read: async (key) => data.get(key),
    write: async (key, value) => {
      data.set(key, value);
    },
  };
}

function setup(initial: Record<string, string> = {}) {
  const storage = memoryStorage(initial);
  const store = createSettingsStore(storage);
  const registry = createRegistry(DEFS.map((def) => entryOf(def, store)));
  return { storage, store, registry };
}

describe('createSettingsStore', () => {
  it('reads the default when nothing is saved, and when the saved value is not one the setting allows', async () => {
    const { store } = setup({ textSize: '99', cafe: 'maybe' });
    expect(await store.get(theme)).toBe('light');
    expect(await store.get(textSize)).toBe(16);
    expect(await store.get(cafe)).toBe('off');
  });

  it('saves as text through the injected storage and tells each listener once', async () => {
    const { storage, store } = setup();
    const heard = vi.fn();
    const heardTheme = vi.fn();
    const anyChange = vi.fn();
    store.subscribe(anyChange);
    const stop = store.onSetting(theme, heardTheme);
    store.onSetting(cafe, heard);
    await store.set(theme, 'dark');
    await store.set(textSize, 20);
    expect(storage.data.get('theme')).toBe('dark');
    expect(storage.data.get('textSize')).toBe('20');
    expect(await store.get(theme)).toBe('dark');
    expect(await store.get(textSize)).toBe(20);
    expect(heardTheme).toHaveBeenCalledTimes(1);
    expect(heardTheme).toHaveBeenCalledWith('dark');
    expect(heard).not.toHaveBeenCalled();
    expect(anyChange.mock.calls).toEqual([['theme', 'dark'], ['textSize', '20']]);
    stop();
    await store.set(theme, 'light');
    expect(heardTheme).toHaveBeenCalledTimes(1);
  });

  it('does not tell anyone when the storage fails to save', async () => {
    const storage = memoryStorage();
    storage.write = async () => {
      throw new Error('disk full');
    };
    const store = createSettingsStore(storage);
    const heard = vi.fn();
    store.subscribe(heard);
    await expect(store.set(theme, 'dark')).rejects.toThrow('disk full');
    expect(heard).not.toHaveBeenCalled();
  });

  it('tells a listener the value as the setting reads it back', async () => {
    const { store } = setup();
    const heard = vi.fn();
    store.onSetting(textSize, heard);
    await store.set(textSize, 20);
    expect(heard).toHaveBeenCalledWith(20);
  });
});

describe('createRegistry', () => {
  it('finds an entry by key, with what the Settings screen needs of it', () => {
    const { registry } = setup();
    const entry = registry.settingOf('syncEvery');
    expect(entry).toMatchObject({ key: 'syncEvery', label: 'How often', section: 'sync', allowed: { kind: 'choice' } });
    expect(entry?.dependsOn?.key).toBe('sync');
    expect(registry.settingOf('nothing')).toBeUndefined();
    expect(registry.entries.map((e) => e.key)).toEqual(DEFS.map((d) => d.key));
  });

  it('refuses two entries with one key', () => {
    const { store } = setup();
    expect(() => createRegistry([entryOf(theme, store), entryOf(theme, store)])).toThrow(/theme/);
  });

  it('reads and writes an entry through its store, and shows its value as a person reads it', async () => {
    const { registry, storage } = setup({ theme: 'dark' });
    const entry = registry.settingOf('theme');
    expect(await entry?.read()).toBe('dark');
    await entry?.write('light');
    expect(storage.data.get('theme')).toBe('light');
    expect(entry?.show('dark')).toBe('Theme: Dark');
    expect(registry.settingOf('textSize')?.show(18)).toBe('Text size: 18');
    await registry.write('theme', 'dark');
    expect(storage.data.get('theme')).toBe('dark');
    await expect(registry.write('nothing', 'x')).rejects.toThrow(/nothing/);
  });

  describe('applyChanges', () => {
    it('applies valid changes in order, keeping what each replaced', async () => {
      const { registry, storage } = setup();
      const { applied, refused } = await registry.applyChanges([
        { key: 'theme', value: 'dark' },
        { key: 'textSize', value: 20 },
        { key: 'theme', value: 'light' },
      ]);
      expect(refused).toEqual([]);
      expect(applied).toEqual([
        { key: 'theme', label: 'Theme', from: 'light', to: 'dark', shown: 'Theme: Dark' },
        { key: 'textSize', label: 'Text size', from: 16, to: 20, shown: 'Text size: 20' },
        { key: 'theme', label: 'Theme', from: 'dark', to: 'light', shown: 'Theme: Light' },
      ]);
      expect(storage.data.get('textSize')).toBe('20');
    });

    it('refuses what the registry does not allow, each with a plain sentence, and writes nothing for it', async () => {
      const { registry, storage } = setup();
      const { applied, refused } = await registry.applyChanges([
        { key: 'theme', value: 'purple' },
        { key: 'textSize', value: 99 },
        { key: 'textSize', value: '20' },
        { key: 'nothing', value: 1 },
        { key: 'theme' },
        'theme',
      ]);
      expect(applied).toEqual([]);
      expect(refused).toHaveLength(6);
      expect(refused[0]).toBe('Left out Theme: "purple" is not a value it allows.');
      expect(refused[3]).toBe('Left out "nothing": the app has no such setting.');
      expect(storage.data.size).toBe(0);
    });

    it('can skip a change to the value it already holds', async () => {
      const { registry } = setup();
      const { applied, refused } = await registry.applyChanges([{ key: 'theme', value: 'light' }, { key: 'theme', value: 'dark' }], { skipUnchanged: true });
      expect(refused).toEqual([]);
      expect(applied.map((c) => c.to)).toEqual(['dark']);
    });

    it('takes no more than MAX_CHANGES at once, and ignores what is not a list', async () => {
      const { registry } = setup();
      const many = Array.from({ length: 12 }, (_, i) => ({ key: 'textSize', value: 12 + (i % 2) * 2 }));
      const { applied, refused } = await registry.applyChanges(many);
      expect(applied).toHaveLength(10);
      expect(refused).toEqual(['Left out 2 more changes than the app takes at once.']);
      expect(await registry.applyChanges('nope')).toEqual({ applied: [], refused: [] });
    });

    it('holds a text setting to its own rule and to the longest text it takes', async () => {
      const storage = memoryStorage();
      const store = createSettingsStore(storage);
      const { defineSetting } = await import('../src/index.js');
      const goal = defineSetting({
        key: 'goal',
        default: 'none',
        parse: (raw) => (typeof raw === 'string' && raw !== '' ? raw : 'none'),
        allowed: { kind: 'text', valid: (v) => v.length > 0, example: 'read more' },
        section: 'look',
        label: 'Goal',
        hint: 'What you want.',
      });
      const registry = createRegistry([entryOf(goal, store)], { textMax: 10 });
      const { applied, refused } = await registry.applyChanges([{ key: 'goal', value: 'walk' }, { key: 'goal', value: 'a very long goal indeed' }, { key: 'goal', value: '' }]);
      expect(applied.map((c) => c.to)).toEqual(['walk']);
      expect(refused).toHaveLength(2);
    });
  });

  it('offers a change as the sentence a button uses, or nothing for what applyChanges would refuse', () => {
    const { registry } = setup();
    expect(registry.offeredChange({ key: 'theme', value: 'dark' })).toEqual({ key: 'theme', value: 'dark', text: 'Change Theme: Dark' });
    expect(registry.offeredChange({ key: 'theme', value: 'purple' })).toBeUndefined();
    expect(registry.offeredChange({ key: 'nothing', value: 1 })).toBeUndefined();
    expect(registry.offeredChange(null)).toBeUndefined();
  });

  it('puts back what a change replaced', async () => {
    const { registry, storage } = setup();
    const { applied } = await registry.applyChanges([{ key: 'theme', value: 'dark' }]);
    await registry.undoChange(applied[0]);
    expect(storage.data.get('theme')).toBe('light');
  });

  it('reports what every setting holds now, with a value its choices do not name as "other"', async () => {
    const { registry, storage } = setup({ sync: 'on' });
    storage.data.set('theme', 'dark');
    const now = await registry.currentSettings();
    expect(now).toMatchObject({ theme: 'dark', cafe: 'off', textSize: 16, sync: 'on', syncEvery: '15' });
    expect(Object.keys(now)).toEqual(DEFS.map((d) => d.key));
    const odd = createRegistry([{ ...entryOf(sync, createSettingsStore(storage)), read: async () => 'purple' }]);
    expect(await odd.currentSettings()).toEqual({ sync: 'other' });
  });
});
