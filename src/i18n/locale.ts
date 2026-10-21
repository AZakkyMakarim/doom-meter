/** A language the app has texts for. */
export type Locale = 'en' | 'id';

export const LOCALES: readonly Locale[] = ['en', 'id'];

/** What the user picks in Settings: a fixed language, or whatever the device uses. */
export type LanguagePreference = 'system' | Locale;

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ['system', 'en', 'id'];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return LANGUAGE_PREFERENCES.includes(value as LanguagePreference);
}

/** The supported language a device tag (`id-ID`, `en_GB`, legacy `in_ID`) stands for, if any. */
function localeOfTag(tag: string | null | undefined): Locale | null {
  const language = (tag ?? '').split(/[-_]/)[0].toLowerCase();
  // Android still reports Indonesian as the old ISO code "in".
  const code = language === 'in' ? 'id' : language;
  return LOCALES.find((locale) => locale === code) ?? null;
}

/**
 * The language to show: the user's choice, or for "System" the device language when the
 * app supports it, otherwise English.
 */
export function resolveLocale(
  preference: LanguagePreference,
  deviceTag: string | null | undefined,
): Locale {
  if (preference !== 'system') return preference;
  return localeOfTag(deviceTag) ?? DEFAULT_LOCALE;
}
