/** Shared text formatting for counts and Watch time (MASTER.md section 6.1). */
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translate';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function split(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** `mm:ss`, or `h:mm:ss` from one hour on. Digits and colons read the same in every language. */
export function formatClock(ms: number): string {
  const { hours, minutes, seconds } = split(ms);
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
}

/** `1 video`, `2 videos`: the number with its unit, in the plural form of the language. */
export function plural(
  n: number,
  unit: 'video' | 'hour' | 'minute' | 'second',
  locale: Locale = DEFAULT_LOCALE,
): string {
  return t(locale, `count.${unit}`, { count: n });
}

/** For screen readers: `38 minutes 12 seconds`. */
export function spokenDuration(ms: number, locale: Locale = DEFAULT_LOCALE): string {
  const { hours, minutes, seconds } = split(ms);
  const parts = [plural(minutes, 'minute', locale), plural(seconds, 'second', locale)];
  if (hours > 0) parts.unshift(plural(hours, 'hour', locale));
  return parts.join(' ');
}
