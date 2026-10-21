import { msg } from '../i18n/translate';
import type { KeyValueStore } from '../storage';
import { clockLabel } from './clockLabel';
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
   * change leaves everything as it was and returns the reason. A change made before
   * the saved settings are read is merged on top of them, never over them.
   */
  update(patch: SettingsPatch): Promise<SettingsResult>;
  subscribe(listener: (settings: Settings) => void): () => void;
  /**
   * Lets a running Lockout veto changes: return its end time (epoch ms) to refuse a patch, else null.
   * A promise holds the change back until the answer is known.
   */
  setRefusal(refusal: (patch: SettingsPatch) => Verdict | Promise<Verdict>): void;
}

type Verdict = { endsAt: number } | null;

export interface SettingsStoreOptions {
  store: KeyValueStore;
}

export function createSettingsStore(options: SettingsStoreOptions): SettingsStore {
  const { store } = options;
  const listeners = new Set<(settings: Settings) => void>();
  let current: Settings = DEFAULT_SETTINGS;
  let loaded = false;
  let loading: Promise<Settings> | null = null;
  /** Everything changed before the saved settings arrived; wins only for the keys it names. */
  let earlyPatch: SettingsPatch = {};
  let earlySaveFailed = false;
  let writes: Promise<unknown> = Promise.resolve();
  let refusal: Parameters<SettingsStore['setRefusal']>[0] = () => null;

  function notify() {
    listeners.forEach((listener) => listener(current));
  }

  /** Queues a save of the settings as they are now. */
  function save(): Promise<unknown> {
    const json = JSON.stringify(current);
    const write = writes.then(() => store.set(SETTINGS_KEY, json));
    writes = write.catch(() => undefined);
    return write;
  }

  /** Reads the saved settings once and merges any early change on top of them. */
  function ensureLoaded(): Promise<Settings> {
    loading ??= (async () => {
      let saved: Settings = DEFAULT_SETTINGS;
      try {
        const raw = await store.get(SETTINGS_KEY);
        if (raw !== null) saved = sanitizeSettings(JSON.parse(raw));
      } catch {
        // Unreadable or corrupt: start from the defaults.
      }
      const hadEarlyChange = Object.keys(earlyPatch).length > 0;
      const merged = applyPatch(saved, earlyPatch);
      current = merged.ok ? merged.settings : saved;
      loaded = true;
      earlyPatch = {};
      notify();
      if (hadEarlyChange) {
        try {
          await save();
        } catch {
          earlySaveFailed = true;
        }
      }
      return current;
    })();
    return loading;
  }

  return {
    get: () => current,

    load: ensureLoaded,

    async update(patch) {
      const decided = refusal(patch);
      const locked = decided instanceof Promise ? await decided : decided;
      if (locked !== null) {
        return {
          ok: false,
          error: msg('settings.error.lockout', { time: clockLabel(locked.endsAt) }),
          lockedUntil: locked.endsAt,
        };
      }
      const result = applyPatch(current, patch);
      if (!result.ok) return result;
      current = result.settings;
      notify();
      try {
        if (loaded) {
          await save();
        } else {
          // The saved copy has not been read yet: remember the change, and let the load
          // merge it over what was saved and write the merged result.
          earlyPatch = { ...earlyPatch, ...patch };
          await ensureLoaded();
          if (earlySaveFailed) throw new Error('save failed');
        }
        return { ok: true, settings: current };
      } catch {
        return { ok: false, error: msg('settings.error.save') };
      }
    },

    setRefusal(next) {
      refusal = next;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
