import { translate } from '../i18n/translate';
import { createLockoutEngine } from '../lockout/lockoutEngine';
import { createMemoryKeyValueStore } from '../storage';
import { DEFAULT_SETTINGS } from './settings';
import type { SettingsPatch } from './settings';
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
    if (!result.ok) expect(translate('en', result.error)).toMatch(/0 to 23/);
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

  it('an early change is merged over the saved settings, which are never wiped by defaults', async () => {
    const saved = {
      ...DEFAULT_SETTINGS,
      rolloverHour: 5,
      haptics: false,
      thresholds: { videos: [2, 4, 6, 8], minutes: [1, 2, 3, 4] },
    };
    const kv = createMemoryKeyValueStore({ [SETTINGS_KEY]: JSON.stringify(saved) });
    const store = createSettingsStore({ store: kv });
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s.rolloverHour));

    // update() runs before load() has resolved.
    const updating = store.update({ compactMode: true });
    const loading = store.load();
    expect((await updating).ok).toBe(true);
    await loading;

    const merged = store.get();
    expect(merged.compactMode).toBe(true); // the patch wins for the key it set
    expect(merged.rolloverHour).toBe(5); // saved values survive
    expect(merged.haptics).toBe(false);
    expect(merged.thresholds).toEqual(saved.thresholds);
    expect(seen[seen.length - 1]).toBe(5); // listeners (the engine) get the merged result

    const onDisk = JSON.parse((await kv.get(SETTINGS_KEY)) as string);
    expect(onDisk).toEqual({ ...saved, compactMode: true });
  });

  it('an early change wins over the saved value for the same key only', async () => {
    const kv = createMemoryKeyValueStore({
      [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, rolloverHour: 5, positionDp: 16 }),
    });
    const store = createSettingsStore({ store: kv });
    await store.update({ rolloverHour: 2 });
    expect(store.get().rolloverHour).toBe(2);
    expect(store.get().positionDp).toBe(16);
  });

  it('reports a failed save but keeps the change in force', async () => {
    const kv = createMemoryKeyValueStore();
    kv.set = () => Promise.reject(new Error('disk full'));
    const store = createSettingsStore({ store: kv });
    const result = await store.update({ haptics: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(translate('en', result.error)).toMatch(/could not save/i);
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

  describe('during a Lockout', () => {
    const HOUR = 3_600_000;
    const start = new Date(2026, 0, 10, 12, 0).getTime();

    /** A store whose changes the Lockout engine may refuse, with a Lockout of 1 hour running. */
    async function rig() {
      let now = start;
      const engine = createLockoutEngine({ clock: { now: () => now }, store: createMemoryKeyValueStore() });
      engine.setRules({ punishments: ['1h', 'off', 'off', 'off'], rolloverHour: 4 });
      await engine.load();
      const kv = createMemoryKeyValueStore();
      const store = createSettingsStore({ store: kv });
      store.setRefusal(engine.refusal);
      engine.observeTier('2026-01-10', 0); // the first look only seeds what the Day had reached
      engine.observeTier('2026-01-10', 1);
      return { store, kv, advance: (ms: number) => (now += ms) };
    }

    it.each([
      ['a Punishment', { punishments: ['off', 'off', 'off', 'off'] as const }],
      ['the thresholds', { thresholds: DEFAULT_SETTINGS.thresholds }],
      ['the rollover hour', { rolloverHour: 3 }],
    ])('refuses %s with the end time and changes and saves nothing', async (_name, patch) => {
      const { store, kv } = await rig();
      const listener = jest.fn();
      store.subscribe(listener);
      const before = store.get();
      const result = await store.update(patch as SettingsPatch);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const end = new Date(start + HOUR);
      const hhmm = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      expect(result.lockedUntil).toBe(start + HOUR);
      expect(translate('en', result.error)).toBe("Can't change this, Lockout runs until " + hhmm);
      expect(translate('id', result.error)).toBe('Tidak bisa diubah, Lockout sedang berjalan sampai ' + hhmm);
      expect(store.get()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
      expect(await kv.get(SETTINGS_KEY)).toBeNull();
    });

    it('waits for a refusal that is still being decided', async () => {
      const { store } = await rig();
      store.setRefusal(() => Promise.resolve({ endsAt: start + HOUR }));
      const result = await store.update({ rolloverHour: 3 });
      expect(result.ok).toBe(false);
      expect(store.get().rolloverHour).not.toBe(3);
    });

    it('still saves the other settings', async () => {
      const { store } = await rig();
      expect((await store.update({ compactMode: true, haptics: false, language: 'id' })).ok).toBe(true);
      expect(store.get().compactMode).toBe(true);
    });

    it('saves all three again once the Lockout ends', async () => {
      const { store, advance } = await rig();
      advance(HOUR);
      const result = await store.update({ punishments: ['off', 'off', 'off', 'off'], rolloverHour: 3 });
      expect(result.ok).toBe(true);
      expect(store.get().rolloverHour).toBe(3);
    });
  });
});
