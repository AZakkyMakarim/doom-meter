import { NativeModules, Platform } from 'react-native';

/**
 * The device's language tag (`id-ID`, `en_US`), or null when it cannot be read.
 * Intl follows the device language as it changes; the native constant is the fallback.
 */
export function deviceLocaleTag(): string | null {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    if (tag) return tag;
  } catch {
    // Intl can be missing on a bare engine; use the native value.
  }
  const native: unknown =
    Platform.OS === 'android' ? NativeModules.I18nManager?.localeIdentifier : undefined;
  return typeof native === 'string' ? native : null;
}
