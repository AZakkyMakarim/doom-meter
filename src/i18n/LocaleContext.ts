import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { deviceLocaleTag } from './deviceLocale';
import { DEFAULT_LOCALE, resolveLocale } from './locale';
import type { LanguagePreference, Locale } from './locale';

/** The language every screen reads its texts in. Provided once by the app root. */
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * The language to show for the user's choice. "System" is read again each time the app
 * returns to the foreground, which is when a device language change can have happened.
 */
export function useResolvedLocale(preference: LanguagePreference): Locale {
  const [deviceTag, setDeviceTag] = useState(deviceLocaleTag);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setDeviceTag(deviceLocaleTag());
    });
    return () => sub.remove();
  }, []);
  return resolveLocale(preference, deviceTag);
}
