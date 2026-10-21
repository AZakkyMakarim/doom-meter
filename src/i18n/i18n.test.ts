import { en } from './messages.en';
import { id } from './messages.id';
import { resolveLocale } from './locale';
import { formatNumber, joinList, missingTranslations, translate } from './translate';
import { tierLabel, tierSentence } from './text';

describe('resolveLocale', () => {
  it('uses the chosen language when it is not System', () => {
    expect(resolveLocale('en', 'id-ID')).toBe('en');
    expect(resolveLocale('id', 'en-US')).toBe('id');
  });

  it('follows the device language for System, in any tag spelling', () => {
    expect(resolveLocale('system', 'id-ID')).toBe('id');
    expect(resolveLocale('system', 'id_ID')).toBe('id');
    expect(resolveLocale('system', 'en_GB')).toBe('en');
  });

  it('reads the legacy Android code "in" as Indonesian', () => {
    expect(resolveLocale('system', 'in_ID')).toBe('id');
  });

  it('falls back to English for an unsupported or unknown device language', () => {
    expect(resolveLocale('system', 'de-DE')).toBe('en');
    expect(resolveLocale('system', '')).toBe('en');
    expect(resolveLocale('system', null)).toBe('en');
  });
});

describe('translate', () => {
  it('fills {params} and picks the plural form of the locale', () => {
    expect(translate('en', { id: 'count.video', params: { count: 1 } })).toBe('1 video');
    expect(translate('en', { id: 'count.video', params: { count: 0 } })).toBe('0 videos');
    expect(translate('en', { id: 'count.video', params: { count: 2 } })).toBe('2 videos');
  });

  it('uses the Indonesian text when there is one, and English when there is not', () => {
    const ref = { id: 'settings.language.title' } as const;
    expect(translate('id', ref)).toBe(id['settings.language.title']);
    expect(translate('id', ref)).not.toBe(en['settings.language.title']);
    // An id missing from the Indonesian catalog reads in English rather than breaking.
    expect(translate('id', { id: 'settings.title' })).toBe(en['settings.title']);
  });

  it('never has an Indonesian id the English catalog does not know', () => {
    expect(Object.keys(id).filter((key) => !(key in en))).toEqual([]);
  });

  it('lists which ids a locale still has to translate', () => {
    expect(missingTranslations('en')).toEqual([]);
    expect(missingTranslations('id')).toContain('settings.title');
    expect(missingTranslations('id')).not.toContain('settings.language.title');
  });
});

describe('numbers and lists', () => {
  it('keeps English numbers plain and groups Indonesian thousands with a dot', () => {
    expect(formatNumber('en', 12345)).toBe('12345');
    expect(formatNumber('id', 12345)).toBe('12.345');
    expect(formatNumber('id', 999)).toBe('999');
  });

  it('joins a list the way the language does', () => {
    expect(joinList('en', ['a'])).toBe('a');
    expect(joinList('en', ['a', 'b'])).toBe('a and b');
    expect(joinList('en', ['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('Tier text', () => {
  it('names a Tier from the catalog and says it as a sentence', () => {
    expect(tierLabel(2, 'en')).toBe('Washed');
    expect(tierSentence(2, 'en')).toBe('Level 3 of 5, Washed.');
  });
});
