import { useEffect, useState } from 'react';
import { settingsStore } from './deviceSettings';
import type { Settings } from './settings';

/** The current app settings, kept in step with the settings store. */
export function useSettings(): Settings {
  const [settings, setSettings] = useState(() => settingsStore.get());
  useEffect(() => {
    setSettings(settingsStore.get());
    return settingsStore.subscribe(setSettings);
  }, []);
  return settings;
}
