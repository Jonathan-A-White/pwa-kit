// @vitest-environment jsdom
// A connection: one switch (Off until the person turns it on), its fields hidden while Off, and useConnectionOn that says so live.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createConnections, createRegistry, createSettingsStore, rowsInOrder, visibleRows, type SettingsSection, type SettingsStorage } from '../src/index.js';

afterEach(cleanup);

type Section = 'accounts';
const SECTIONS: readonly SettingsSection<Section>[] = [{ id: 'accounts', title: 'Accounts' }];

function memory(): SettingsStorage & { saved: Map<string, string> } {
  const saved = new Map<string, string>();
  return { saved, read: (key) => saved.get(key), write: (key, value) => void saved.set(key, value) };
}

function setup() {
  const storage = memory();
  const store = createSettingsStore(storage);
  const connections = createConnections<Section>(store);
  const notes = connections.register({
    key: 'notesync',
    name: 'Notes sync',
    section: 'accounts',
    hint: 'Keep your notes on the sync service.',
    fields: [
      { key: 'server', label: 'Server', hint: 'Where the notes go.', default: 'https://sync.example', allowed: { kind: 'text', valid: (v) => v.startsWith('https://'), example: 'https://sync.example' } },
      { key: 'every', label: 'Every', hint: 'Minutes between syncs.', default: 15, allowed: { kind: 'number', min: 1, max: 60, step: 1 } },
    ],
  });
  const registry = createRegistry(connections.entries);
  return { storage, store, connections, notes, registry };
}

function Probe({ connections }: { connections: ReturnType<typeof setup>['connections'] }) {
  const on = connections.useConnectionOn('notesync');
  return <p data-testid="probe">{on ? 'drawn' : 'nothing'}</p>;
}

describe('a connection', () => {
  it('is Off for a stranger: nothing saved reads as Off, and useConnectionOn says false', async () => {
    const { connections } = setup();
    await expect(connections.isOn('notesync')).resolves.toBe(false);
    render(<Probe connections={connections} />);
    expect(screen.getByTestId('probe').textContent).toBe('nothing');
    await waitFor(() => expect(connections.isOn('notesync')).resolves.toBe(false));
    expect(screen.getByTestId('probe').textContent).toBe('nothing');
  });

  it('is true after the switch is turned on, live, and false again after it is turned off', async () => {
    const { connections, registry } = setup();
    render(<Probe connections={connections} />);
    await act(async () => registry.write('notesync', 'on'));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('drawn'));
    await expect(connections.isOn('notesync')).resolves.toBe(true);
    await act(async () => registry.write('notesync', 'off'));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('nothing'));
  });

  it('reads a switch saved On before the hook mounted', async () => {
    const { connections, storage } = setup();
    storage.saved.set('notesync', 'on');
    render(<Probe connections={connections} />);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('drawn'));
  });

  it('reads anything saved that is not On as Off', async () => {
    const { connections, storage } = setup();
    storage.saved.set('notesync', 'yes please');
    await expect(connections.isOn('notesync')).resolves.toBe(false);
  });

  it('hides its fields while Off and shows them once On, in the Settings row list', () => {
    const { registry } = setup();
    const rows = rowsInOrder<Section, (typeof registry.entries)[number]>(SECTIONS, registry.entries);
    const keys = (values: Record<string, string>) => visibleRows(rows, values, '').map((r) => r.key);
    expect(keys({ notesync: 'off' })).toEqual(['notesync']);
    expect(keys({})).toEqual(['notesync']);
    expect(keys({ notesync: 'on' })).toEqual(['notesync', 'notesync.server', 'notesync.every']);
  });

  it('does not find a field by search while Off: the switch that turns it on is shown in its place', () => {
    const { registry } = setup();
    const rows = rowsInOrder<Section, (typeof registry.entries)[number]>(SECTIONS, registry.entries);
    expect(visibleRows(rows, { notesync: 'off' }, 'minutes').map((r) => r.key)).toEqual(['notesync']);
  });

  it('has a switch row named for the connection, Off by default, and fields that depend on it', () => {
    const { registry, notes } = setup();
    const row = registry.settingOf('notesync');
    expect(row?.label).toBe('Notes sync');
    expect(row?.allowed).toEqual({ kind: 'choice', values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] });
    expect(notes.fieldKey('server')).toBe('notesync.server');
    expect(registry.settingOf('notesync.server')?.dependsOn?.key).toBe('notesync');
    expect(registry.settingOf('notesync.server')?.dependsOn?.shown('on')).toBe(true);
    expect(registry.settingOf('notesync.server')?.dependsOn?.shown('off')).toBe(false);
  });

  it('saves a field through the registry, and refuses a value the field does not allow', async () => {
    const { registry } = setup();
    const result = await registry.applyChanges([
      { key: 'notesync.every', value: 30 },
      { key: 'notesync.server', value: 'http://plain.example' },
    ]);
    expect(result.applied.map((c) => c.key)).toEqual(['notesync.every']);
    expect(result.refused).toHaveLength(1);
  });

  it('keeps one connection\'s switch apart from another\'s', async () => {
    const { connections, registry } = setup();
    connections.register({ key: 'budget', name: 'Budget', section: 'accounts', hint: 'Your budget.', fields: [] });
    await registry.write('notesync', 'on');
    await expect(connections.isOn('notesync')).resolves.toBe(true);
    await expect(connections.isOn('budget')).resolves.toBe(false);
  });

  it('throws for a key nobody registered, a key twice, a connection with no name, and a field named twice', async () => {
    const { connections } = setup();
    await expect(connections.isOn('nothing')).rejects.toThrow(/nothing/);
    expect(() => connections.register({ key: 'notesync', name: 'Again', section: 'accounts', hint: 'x', fields: [] })).toThrow(/notesync/);
    expect(() => connections.register({ key: 'a', name: ' ', section: 'accounts', hint: 'x', fields: [] })).toThrow(/name/);
    const field = { key: 'f', label: 'F', hint: 'f', default: 'x', allowed: { kind: 'text', valid: () => true, example: 'x' } } as const;
    expect(() => connections.register({ key: 'b', name: 'B', section: 'accounts', hint: 'x', fields: [field, field] })).toThrow(/f/);
  });
});
