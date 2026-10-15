import { createMemoryKeyValueStore } from '../storage';
import { DEFAULT_SETTINGS } from './settings';
import { SETTINGS_KEY, createSettingsStore } from './settingsStore';

describe('settings store', () => {
  it('starts on the defaults', () => {
    const store = createSettingsStore({ store: createMemoryKeyValueStore() });
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('applies a change immediately, tells listeners, and persists it', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createSettingsStore({ store: kv });
    const seen: boolean[] = [];
    store.subscribe((s) => seen.push(s.compactMode));

    const pending = store.update({ compactMode: true });
    // Before the write finishes the new value is already in force.
    expect(store.get().compactMode).toBe(true);
    expect(seen).toEqual([true]);
    expect((await pending).ok).toBe(true);

    const reloaded = createSettingsStore({ store: kv });
    expect((await reloaded.load()).compactMode).toBe(true);
  });

  it('keeps the old value and says why when a change is invalid', async () => {
    const store = createSettingsStore({ store: createMemoryKeyValueStore() });
    const listener = jest.fn();
    store.subscribe(listener);
    const result = await store.update({ rolloverHour: 25 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/0 to 23/);
    expect(store.get().rolloverHour).toBe(DEFAULT_SETTINGS.rolloverHour);
    expect(listener).not.toHaveBeenCalled();
  });

  it('load falls back to defaults on corrupt data', async () => {
    const kv = createMemoryKeyValueStore({ [SETTINGS_KEY]: '{not json' });
    const store = createSettingsStore({ store: kv });
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('load tells listeners about the saved settings', async () => {
    const kv = createMemoryKeyValueStore({
      [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, rolloverHour: 2 }),
    });
    const store = createSettingsStore({ store: kv });
    const hours: number[] = [];
    store.subscribe((s) => hours.push(s.rolloverHour));
    await store.load();
    expect(hours).toEqual([2]);
  });

  it('a change made before load finishes is not overwritten by the load', async () => {
    const kv = createMemoryKeyValueStore({
      [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, haptics: false }),
    });
    const store = createSettingsStore({ store: kv });
    const loading = store.load();
    await store.update({ compactMode: true });
    await loading;
    expect(store.get().compactMode).toBe(true);
  });

  it('reports a failed save but keeps the change in force', async () => {
    const kv = createMemoryKeyValueStore();
    kv.set = () => Promise.reject(new Error('disk full'));
    const store = createSettingsStore({ store: kv });
    const result = await store.update({ haptics: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/could not save/i);
    expect(store.get().haptics).toBe(false);
  });

  it('stops notifying after unsubscribe', async () => {
    const store = createSettingsStore({ store: createMemoryKeyValueStore() });
    const listener = jest.fn();
    const off = store.subscribe(listener);
    off();
    await store.update({ haptics: false });
    expect(listener).not.toHaveBeenCalled();
  });
});
