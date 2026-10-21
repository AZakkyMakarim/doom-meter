import type { Message, MessageId } from './messages.en';

/**
 * Indonesian. Holds only a few texts so far, enough to see the language switch on the
 * screens and the pill; the full translation is a separate ticket. An id that is missing
 * here reads in English (see `translate`), and `missingTranslations('id')` lists them.
 */
export const id: Partial<Record<MessageId, Message>> = {
  'unit.video': { one: 'video', other: 'video' },
  'count.video': { one: '{count} video', other: '{count} video' },
  'day.today': 'Hari ini',
  'nav.today': 'Hari ini',
  'today.title': 'Hari ini',
  'pill.collapsed': 'Tertutup',
  'panel.close': 'Tutup',
  'settings.language.title': 'Bahasa',
  'settings.language.hint': 'Berlaku langsung, di aplikasi dan di pill.',
  'settings.language.system': 'Sistem',
};
