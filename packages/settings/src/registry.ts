// The registry: every setting an app has, as a list the app can ask about by key. A setting is read and saved through a store over storage the
// app injects (nothing here knows a database, a browser store or a bus), and a change an assistant asks for in words is checked against the list,
// applied through the same write the Settings screen uses, and undone. A setting declared once (defineSetting) becomes an entry with `entryOf`.
import { isAllowed, type Allowed, type Dependency, type SettingDef, type SettingValue } from './define.js';

/** Where the values are kept. Every value is text. The app brings its own: `{ read: (key) => db.get(key), write: (key, value) => db.put(key, value) }`. */
export interface SettingsStorage {
  read(key: string): Promise<string | undefined> | string | undefined;
  write(key: string, value: string): Promise<void> | void;
}

export interface SettingsStore {
  /** The saved value; the default when nothing is saved or the saved value is not one the setting allows. */
  get<T extends SettingValue>(def: SettingDef<T, string>): Promise<T>;
  /** Saves `value` as text, then tells the listeners, once. A failed save tells nobody and rejects. */
  set<T extends SettingValue>(def: SettingDef<T, string>, value: T): Promise<void>;
  /** Calls `listener` with the key and the saved text after every later save of any setting; returns the unsubscribe. */
  subscribe(listener: (key: string, value: string) => void): () => void;
  /** Calls `listener` with the value, as the setting reads it, after each later save of this setting; returns the unsubscribe. */
  onSetting<T extends SettingValue>(def: SettingDef<T, string>, listener: (value: T) => void): () => void;
}

export function createSettingsStore(storage: SettingsStorage): SettingsStore {
  const listeners = new Set<(key: string, value: string) => void>();
  return {
    async get(def) {
      return def.parse(await storage.read(def.key));
    },
    async set(def, value) {
      const text = String(value);
      await storage.write(def.key, text);
      for (const listener of [...listeners]) listener(def.key, text);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onSetting(def, listener) {
      const heard = (key: string, value: string): void => {
        if (key === def.key) listener(def.parse(value));
      };
      listeners.add(heard);
      return () => void listeners.delete(heard);
    },
  };
}

/** What the Settings screen needs of an entry besides its control. */
export interface RowMeta<S extends string = string> {
  section: S;
  /** the longer explanation, for an assistant and the row's 'More help' */
  help?: string;
  dependsOn?: Dependency;
}

export interface SettingEntry<S extends string = string> extends RowMeta<S> {
  /** what a change asked for and `AppliedChange` call it: 'greekRate' */
  key: string;
  /** what the Settings screen calls it (the name of its control): 'Greek speed' */
  label: string;
  /** one line under the control, searched with the name */
  hint: string;
  allowed: Allowed;
  /** the saved value, as it was before a change */
  read(): Promise<SettingValue>;
  /** saves `value` and tells the store's listeners; `value` is one `read` gave or one `allowed` names */
  write(value: SettingValue): Promise<void>;
  /** the value as a person reads it: 'Text size: 18', 'Theme: Dark' */
  show(value: SettingValue): string;
}

/** The entry of a setting declared once, read and saved through `store`. A setting that is kept elsewhere or needs more on a write is an entry written by hand: spread this one and replace `read` or `write`. */
export function entryOf<S extends string>(def: SettingDef<SettingValue, S>, store: SettingsStore): SettingEntry<S> {
  const { key, label, hint, help, section, dependsOn, allowed } = def;
  return {
    key,
    label,
    hint,
    help,
    section,
    dependsOn,
    allowed,
    read: () => store.get(def),
    // a value the setting allows is saved as it is; anything else is read back as a saved value would be (the default, for a choice)
    write: (value) => store.set(def, isAllowed(allowed, value) ? value : def.parse(value)),
    show: (value) =>
      allowed.kind === 'choice' ? `${label}: ${allowed.values.find((v) => v.value === value)?.label ?? String(value)}` : `${label}: ${String(value)}`,
  };
}

/** One change that was made: what it replaced (`from`), so Undo can put it back. `undone` is set once it has been. */
export interface AppliedChange {
  key: string;
  label: string;
  from: SettingValue;
  to: SettingValue;
  /** 'Text size: 20': what is shown after 'Changed:' */
  shown: string;
  undone?: boolean;
}

export interface ChangeResult {
  applied: AppliedChange[];
  /** one plain sentence for each change that was ignored */
  refused: string[];
}

/** The most changes applyChanges takes at once. */
export const MAX_CHANGES = 10;

/** The longest text a change of a text setting may hold, unless the registry is given another. */
export const TEXT_MAX = 80;

export interface RegistryOptions {
  /** the longest text a requested change of a text setting may hold */
  textMax?: number;
}

export interface Registry<S extends string = string> {
  entries: readonly SettingEntry<S>[];
  settingOf(key: string): SettingEntry<S> | undefined;
  /** Saves a value through the entry's own write; throws for a key that is no setting. */
  write(key: string, value: SettingValue): Promise<void>;
  /** Checks each change asked for against the list and applies the valid ones in order, one after the other (so a later change of the same setting is from
   *  the earlier one). Anything else is ignored and said so in `refused`. */
  applyChanges(changes: unknown, options?: { skipUnchanged?: boolean }): Promise<ChangeResult>;
  /** A change offered instead of made: `{key, value}` checked as applyChanges would, with the sentence a button uses ('Change Theme: Dark'); undefined for anything it would refuse. */
  offeredChange(change: unknown): { key: string; value: SettingValue; text: string } | undefined;
  /** Puts back what `change` replaced, the same way it was written. */
  undoChange(change: AppliedChange): Promise<void>;
  /** What each setting holds now, with a value its choices do not name as 'other': sent with a request so 'slower' is from where it stands. */
  currentSettings(): Promise<Record<string, SettingValue>>;
}

const describe = (value: unknown): string => (typeof value === 'string' ? `"${value}"` : String(value));

export function createRegistry<S extends string>(entries: readonly SettingEntry<S>[], options: RegistryOptions = {}): Registry<S> {
  const textMax = options.textMax ?? TEXT_MAX;
  const byKey = new Map<string, SettingEntry<S>>();
  for (const entry of entries) {
    if (byKey.has(entry.key)) throw new Error(`two settings are called ${entry.key}`);
    byKey.set(entry.key, entry);
  }
  const settingOf = (key: string): SettingEntry<S> | undefined => byKey.get(key);

  /** The value a requested `value` stands for, or undefined when the setting does not allow it. */
  const allowedValue = (entry: SettingEntry<S>, value: unknown): SettingValue | undefined => {
    if (typeof value === 'string' && value.length > textMax) return undefined;
    return isAllowed(entry.allowed, value) ? value : undefined;
  };

  const askedKey = (change: unknown): { asked: Record<string, unknown>; entry: SettingEntry<S> | undefined } => {
    const asked = typeof change === 'object' && change !== null ? (change as Record<string, unknown>) : {};
    return { asked, entry: typeof asked.key === 'string' ? settingOf(asked.key) : undefined };
  };

  return {
    entries,
    settingOf,
    async write(key, value) {
      const entry = settingOf(key);
      if (!entry) throw new Error(`no setting called ${key}`);
      await entry.write(value);
    },
    async applyChanges(changes, applyOptions = {}) {
      const result: ChangeResult = { applied: [], refused: [] };
      if (!Array.isArray(changes)) return result;
      for (const change of changes.slice(0, MAX_CHANGES)) {
        const { asked, entry } = askedKey(change);
        if (typeof asked.key !== 'string' || !('value' in asked)) {
          result.refused.push('A change was left out: it was not a setting and a value.');
        } else if (!entry) {
          result.refused.push(`Left out "${asked.key}": the app has no such setting.`);
        } else {
          const value = allowedValue(entry, asked.value);
          if (value === undefined) {
            result.refused.push(`Left out ${entry.label}: ${describe(asked.value)} is not a value it allows.`);
          } else {
            const from = await entry.read();
            // already set that way: nothing changed, so nothing is written
            if (applyOptions.skipUnchanged && from === value) continue;
            await entry.write(value);
            result.applied.push({ key: entry.key, label: entry.label, from, to: value, shown: entry.show(value) });
          }
        }
      }
      if (changes.length > MAX_CHANGES) result.refused.push(`Left out ${changes.length - MAX_CHANGES} more changes than the app takes at once.`);
      return result;
    },
    offeredChange(change) {
      const { asked, entry } = askedKey(change);
      const value = entry ? allowedValue(entry, asked.value) : undefined;
      if (!entry || value === undefined) return undefined;
      return { key: entry.key, value, text: `Change ${entry.show(value)}` };
    },
    async undoChange(change) {
      await settingOf(change.key)?.write(change.from);
    },
    async currentSettings() {
      const read = await Promise.all(
        entries.map(async (s) => {
          const value = await s.read();
          const named = s.allowed.kind === 'choice' ? s.allowed.values.some((v) => v.value === value) : true;
          return [s.key, named ? value : 'other'] as const;
        }),
      );
      return Object.fromEntries(read);
    },
  };
}
