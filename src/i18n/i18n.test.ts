import { en } from './messages.en';
import type { Message, MessageId } from './messages.en';
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
  });

  it('never has an Indonesian id the English catalog does not know', () => {
    expect(Object.keys(id).filter((key) => !(key in en))).toEqual([]);
  });

  it('lists which ids a locale still has to translate', () => {
    expect(missingTranslations('en')).toEqual([]);
  });

  it('has every shipped text translated to Indonesian, with the same {holes}', () => {
    expect(missingTranslations('id')).toEqual([]);
    const holes = (m: Message) =>
      (typeof m === 'string' ? [m] : [m.one, m.other])
        .flatMap((text) => text.match(/\{\w+\}/g) ?? [])
        .sort()
        .filter((hole, i, all) => all.indexOf(hole) === i);
    const mismatched = (Object.keys(en) as MessageId[]).filter(
      (key) => JSON.stringify(holes(en[key])) !== JSON.stringify(holes(id[key] as Message)),
    );
    expect(mismatched).toEqual([]);
  });

  it('leaves no English wording behind in Indonesian, except names that are the same', () => {
    const SAME = new Set<string>([
      'unit.video', 'count.video', 'settings.language.en', 'settings.language.id',
      'settings.overlay.title', 'pill.description', 'history.rowLabel', 'chart.day', 'settings.permission.rowRequired', 'month.3', 'month.8', 'month.10', 'today.tileLabel',
    ]);

    const same = (Object.keys(en) as MessageId[]).filter(
      (key) => !SAME.has(key) && JSON.stringify(en[key]) === JSON.stringify(id[key]),
    );
    expect(same).toEqual([]);
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

  it('names the Tiers in Indonesian', () => {
    expect([0, 1, 2, 3, 4].map((tier) => tierLabel(tier, 'id'))).toEqual([
      'Santuy',
      'Oleng',
      'Madesu',
      'Cengoh',
      'Wassalam',
    ]);
    expect(tierSentence(2, 'id')).toBe('Tingkat 3 dari 5, Madesu.');
  });
});
