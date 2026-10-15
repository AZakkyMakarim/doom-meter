import type { KeyValueStore } from '../storage';
import { DEFAULT_SETTINGS, applyPatch, sanitizeSettings } from './settings';
import type { Settings, SettingsPatch, SettingsResult } from './settings';

export const SETTINGS_KEY = 'doommeter:settings';

export interface SettingsStore {
  get(): Settings;
  /** Read the saved settings (defaults for anything missing) and tell listeners. Call once at startup. */
  load(): Promise<Settings>;
  /**
   * Validate, apply and save a change. A valid change is in force and announced to
   * listeners at once; the returned promise resolves when it is saved. An invalid
   * change leaves everything as it was and returns the reason.
   */
  update(patch: SettingsPatch): Promise<SettingsResult>;
  subscribe(listener: (settings: Settings) => void): () => void;
}

export interface SettingsStoreOptions {
  store: KeyValueStore;
}

export function createSettingsStore(options: SettingsStoreOptions): SettingsStore {
  const { store } = options;
  const listeners = new Set<(settings: Settings) => void>();
  let current: Settings = DEFAULT_SETTINGS;
  let changedSinceStart = false;
  let writes: Promise<unknown> = Promise.resolve();

  function notify() {
    listeners.forEach((listener) => listener(current));
  }

  return {
    get: () => current,

    async load() {
      let saved: Settings = DEFAULT_SETTINGS;
      try {
        const raw = await store.get(SETTINGS_KEY);
        if (raw !== null) saved = sanitizeSettings(JSON.parse(raw));
      } catch {
        // Unreadable or corrupt: start from the defaults.
      }
      // Anything the user changed while the read was running wins over the saved copy.
      if (!changedSinceStart) {
        current = saved;
        notify();
      }
      return current;
    },

    async update(patch) {
      const result = applyPatch(current, patch);
      if (!result.ok) return result;
      current = result.settings;
      changedSinceStart = true;
      notify();
      const json = JSON.stringify(current);
      const write = writes.then(() => store.set(SETTINGS_KEY, json));
      writes = write.catch(() => undefined);
      try {
        await write;
        return result;
      } catch {
        return { ok: false, error: 'Could not save this setting on the device.' };
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
