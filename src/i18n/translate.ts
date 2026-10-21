import { DEFAULT_LOCALE } from './locale';
import type { Locale } from './locale';
import { en } from './messages.en';
import type { Message, MessageId } from './messages.en';
import { id } from './messages.id';

/** A value for a `{hole}`; a nested message is translated in the same language. */
export type Param = string | number | MessageRef;
export type Params = Record<string, Param>;

/**
 * A text still to be translated: the id plus its values. Code that cannot know the
 * language yet (validation, stores) returns one of these and the screen translates it.
 */
export interface MessageRef {
  id: MessageId;
  params?: Params;
}

export function msg(messageId: MessageId, params?: Params): MessageRef {
  return { id: messageId, params };
}

const CATALOGS: Record<Locale, Partial<Record<MessageId, Message>>> = { en, id };

/** Digit group separator per language. English stays ungrouped, as the app always showed it. */
const GROUP_SEPARATOR: Record<Locale, string> = { en: '', id: '.' };

export function formatNumber(locale: Locale, n: number): string {
  const separator = GROUP_SEPARATOR[locale];
  const digits = String(n);
  return separator === '' ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** English splits one from other; Indonesian has no plural form. */
function pluralForm(locale: Locale, count: number): 'one' | 'other' {
  return locale === 'en' && count === 1 ? 'one' : 'other';
}

export function translate(locale: Locale, ref: MessageRef): string {
  // A text the language lacks reads in English, with English plural rules.
  const own = CATALOGS[locale][ref.id];
  const from = own === undefined ? DEFAULT_LOCALE : locale;
  const message = own ?? CATALOGS[DEFAULT_LOCALE][ref.id] ?? ref.id;
  const params = ref.params ?? {};
  const text =
    typeof message === 'string'
      ? message
      : message[pluralForm(from, typeof params.count === 'number' ? params.count : NaN)];
  return text.replace(/\{(\w+)\}/g, (hole, name: string) => {
    const value = params[name];
    if (value === undefined) return hole;
    if (typeof value === 'number') return formatNumber(locale, value);
    return typeof value === 'string' ? value : translate(locale, value);
  });
}

/** Shorthand for a text with values. */
export function t(locale: Locale, messageId: MessageId, params?: Params): string {
  return translate(locale, { id: messageId, params });
}

/** "a", "a and b", "a, b and c". */
export function joinList(locale: Locale, items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return t(locale, 'list.and', { items: items.slice(0, -1).join(', '), last: items[items.length - 1] });
}

/** The ids a language still reads in English. Empty means the translation is complete. */
export function missingTranslations(locale: Locale): MessageId[] {
  return (Object.keys(en) as MessageId[]).filter((key) => !(key in CATALOGS[locale]));
}
