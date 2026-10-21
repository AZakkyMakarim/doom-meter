import { TIER_CATALOG } from '../design/catalog';
import type { Locale } from './locale';
import { t } from './translate';
import type { MessageId } from './messages.en';

/** The name of a Tier (0 to 4) in the given language. */
export function tierLabel(tier: number, locale: Locale): string {
  return t(locale, `tier.${tier}` as MessageId);
}

/** The Tier on its own for screen readers, e.g. "Level 3 of 5, Doomed.". */
export function tierSentence(tier: number, locale: Locale): string {
  return t(locale, 'tier.sentence', {
    level: tier + 1,
    total: TIER_CATALOG.length,
    name: tierLabel(tier, locale),
  });
}
