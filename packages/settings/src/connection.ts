// A connection: a service the app can talk to, kept behind one switch. The switch is Off for a stranger, and the rule is the kit's: while it is Off,
// no screen draws anything of the connection (not its fields in Settings, not a button that uses it). Settings hides the fields by the same dependency
// every other detail uses; the rest of the app asks `useConnectionOn` and draws nothing while it says false (which is also what it says until the
// saved switch has been read). The switch is a setting of its own, saved under the connection's key as 'on' or 'off'; each field is a setting that
// depends on it, saved under '<key>.<field>'. Storage is the store's (createSettingsStore); nothing here knows a database or a service.
import { useEffect, useState } from 'react';
import { defineSetting, isAllowed, type Allowed, type SettingDef, type SettingValue } from './define.js';
import { entryOf, type SettingEntry, type SettingsStore } from './registry.js';

const ON_OFF: Allowed = { kind: 'choice', values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] };

/** A setting that belongs to a connection and is drawn only while the connection is On: a server address, an account, a token. */
export interface ConnectionField {
  /** the field's name within the connection: 'server'. It is saved as '<connection key>.server'. */
  key: string;
  label: string;
  hint: string;
  help?: string;
  allowed: Allowed;
  default: SettingValue;
  /** how a saved value is read back; the default is the saved value when the field allows it, else the default */
  parse?: (raw: unknown) => SettingValue;
}

export interface ConnectionSpec<S extends string = string> {
  /** the switch's key, and the connection's name everywhere else: 'ynab'. A link to the connection opens this row. */
  key: string;
  /** what the switch is called: 'YNAB' */
  name: string;
  section: S;
  /** one line under the switch: what turning it on does */
  hint: string;
  help?: string;
  fields: readonly ConnectionField[];
}

export interface Connection<S extends string = string> {
  key: string;
  name: string;
  /** the switch: 'off' until the person chooses 'on' */
  switch: SettingDef<SettingValue, S>;
  /** the fields, each depending on the switch being 'on' */
  fields: readonly SettingDef<SettingValue, S>[];
  /** the key a field is saved and listed under: fieldKey('server') is 'ynab.server' */
  fieldKey(field: string): string;
}

export interface Connections<S extends string = string> {
  /** Declares a connection and adds its switch and fields to `entries`. Throws for a key already used, a name that is empty or a field named twice. */
  register(spec: ConnectionSpec<S>): Connection<S>;
  /** Every registered connection's switch and fields as registry entries, in the order registered: pass them to createRegistry with the app's own. */
  readonly entries: readonly SettingEntry<S>[];
  connectionOf(key: string): Connection<S> | undefined;
  /** Whether the connection is On now: false for a stranger, and for anything saved but 'on'. Throws for a key nobody registered. */
  isOn(key: string): Promise<boolean>;
  /** Whether the connection is On, live: false until the saved switch is read, and again as soon as it is turned Off. Draw nothing of the connection while it is false. */
  useConnectionOn(key: string): boolean;
}

/** The text a field's saved value is read back from: the value itself when the field allows it, else its default. */
const parseField = (field: ConnectionField): ((raw: unknown) => SettingValue) =>
  field.parse ?? ((raw) => (isAllowed(field.allowed, raw) ? raw : field.default));

export function createConnections<S extends string = string>(store: SettingsStore): Connections<S> {
  const byKey = new Map<string, Connection<S>>();
  const entries: SettingEntry<S>[] = [];

  const connectionOf = (key: string): Connection<S> | undefined => byKey.get(key);
  const need = (key: string): Connection<S> => {
    const connection = connectionOf(key);
    if (!connection) throw new Error(`no connection called ${key}`);
    return connection;
  };
  const isOn = async (key: string): Promise<boolean> => (await store.get(need(key).switch)) === 'on';

  return {
    entries,
    connectionOf,
    isOn,
    register(spec) {
      const { key, name } = spec;
      if (name.trim() === '') throw new Error(`connection ${key} needs a name`);
      if (byKey.has(key)) throw new Error(`two connections are called ${key}`);
      const names = spec.fields.map((f) => f.key);
      const twice = names.find((n, i) => names.indexOf(n) !== i);
      if (twice !== undefined) throw new Error(`connection ${key} has the field ${twice} twice`);

      const switchDef = defineSetting<SettingValue, S>({
        key,
        default: 'off',
        allowed: ON_OFF,
        section: spec.section,
        label: name,
        hint: spec.hint,
        ...(spec.help !== undefined ? { help: spec.help } : {}),
      });
      const dependsOn = { key, shown: (value: string): boolean => value === 'on' };
      const fields = spec.fields.map((f) =>
        defineSetting<SettingValue, S>({
          key: `${key}.${f.key}`,
          default: f.default,
          allowed: f.allowed,
          parse: parseField(f),
          section: spec.section,
          label: f.label,
          hint: f.hint,
          ...(f.help !== undefined ? { help: f.help } : {}),
          dependsOn,
        }),
      );
      const connection: Connection<S> = { key, name, switch: switchDef, fields, fieldKey: (field) => `${key}.${field}` };
      byKey.set(key, connection);
      for (const def of [switchDef, ...fields]) entries.push(entryOf(def, store));
      return connection;
    },
    useConnectionOn(key) {
      const connection = need(key);
      const [on, setOn] = useState(false);
      useEffect(() => {
        let live = true;
        let heard = false;
        // subscribe before reading, and let a change heard win over a read that began before it: the read would be the older value
        const stop = store.onSetting(connection.switch, (value) => {
          heard = true;
          if (live) setOn(value === 'on');
        });
        void Promise.resolve(store.get(connection.switch)).then(
          (value) => live && !heard && setOn(value === 'on'),
          () => undefined,
        );
        return () => {
          live = false;
          stop();
        };
      }, [connection]);
      return on;
    },
  };
}
