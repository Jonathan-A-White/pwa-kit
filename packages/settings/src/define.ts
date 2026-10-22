// A setting declared once: its key, default, the values it allows and how a saved value is read back, and where it sits on the Settings
// screen (section, name, hint, help, what it depends on). The section is the app's own type: pass a union of its section ids and a
// definition naming a section that is not one fails to compile.

/** What a setting holds: a choice's value (text) or a number (a speed, a size). */
export type SettingValue = string | number;

export type Allowed =
  | { kind: 'choice'; values: readonly { value: string; label: string }[] }
  | { kind: 'number'; min: number; max: number; step: number }
  /** free text the entry checks itself: `valid` takes the text a person or the tutor wrote; `example` is one it takes */
  | { kind: 'text'; valid(value: string): boolean; example: string; /** what an assistant is told about the value, after the example */ note?: string };

/** A row that is a detail of another: shown only while `shown(value)` says so of the other's value (as text: 'off', '0', 'on'). */
export interface Dependency {
  /** the other row's key: a setting's, or any other row's the app lists */
  key: string;
  shown(value: string): boolean;
}

export interface SettingDef<T extends SettingValue, S extends string = string> {
  /** the key it is saved under in the storage, and what a change asked for by an assistant calls it: 'theme' */
  key: string;
  /** what it holds while the person has not chosen, or when the saved value is not one it allows */
  default: T;
  /** the saved value, or the default when it is not one of the allowed values */
  parse(raw: unknown): T;
  allowed: Allowed;
  section: S;
  /** what the Settings screen calls it (the name of its control): 'Theme' */
  label: string;
  /** one line under the control, searched with the name: what it does */
  hint: string;
  /** the longer explanation, for the row's 'More help' and for an assistant; written as Markdown or plain words, searched as plain words */
  help?: string;
  dependsOn?: Dependency;
}

/** A definition as it is written: a choice may leave out `parse` (the saved value when it is one of the choices, else the default). */
export type SettingSpec<T extends SettingValue, S extends string = string> = Omit<SettingDef<T, S>, 'parse'> & { parse?: SettingDef<T, S>['parse'] };

/** Whether `value` is one the setting allows: a listed choice, a number in its range, text its own rule accepts. */
export function isAllowed(allowed: Allowed, value: unknown): value is SettingValue {
  if (allowed.kind === 'choice') return typeof value === 'string' && allowed.values.some((v) => v.value === value);
  if (allowed.kind === 'text') return typeof value === 'string' && allowed.valid(value);
  return typeof value === 'number' && Number.isFinite(value) && value >= allowed.min && value <= allowed.max;
}

/** Declares a setting. Throws at once, when the app starts, for a declaration that cannot work: no key, name or hint, a choice with no values, a default
 *  the setting would not allow, or a number or text setting with no `parse`. */
export function defineSetting<T extends SettingValue, S extends string = string>(spec: SettingSpec<T, S>): SettingDef<T, S> {
  const { key, allowed } = spec;
  if (key.trim() === '') throw new Error('a setting needs a key');
  if (spec.label.trim() === '') throw new Error(`setting ${key} needs a label`);
  if (spec.hint.trim() === '') throw new Error(`setting ${key} needs a hint`);
  if (allowed.kind === 'choice' && allowed.values.length === 0) throw new Error(`setting ${key} allows a choice with no values`);
  if (!isAllowed(allowed, spec.default)) throw new Error(`setting ${key} has a default (${String(spec.default)}) that it does not allow`);
  if (spec.parse) return { ...spec, parse: spec.parse };
  if (allowed.kind !== 'choice') throw new Error(`setting ${key} needs its own parse`);
  return { ...spec, parse: (raw) => (isAllowed(allowed, raw) ? (raw as T) : spec.default) };
}
