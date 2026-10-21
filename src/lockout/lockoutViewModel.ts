import { TIER_CATALOG } from '../design/catalog';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { tierLabel, tierSentence } from '../i18n/text';
import { t } from '../i18n/translate';
import { clockLabel } from '../settings/clockLabel';
import type { LockoutStatus } from './lockoutEngine';

/**
 * Everything the native block screen draws, derived from the Lockout status. Native keeps a copy
 * on the device so it keeps blocking after a restart with the app closed; it holds no rules or
 * texts of its own, and decides only "is this app a Platform app and is `endsAt` still ahead".
 */
export type LockoutViewModel =
  | { active: false }
  | {
      active: true;
      /** Epoch ms at which the Lockout ends. */
      endsAt: number;
      /** Name of the mood avatar drawable. */
      avatar: string;
      accentColor: string;
      /** The Tier label. */
      title: string;
      /** "Blocked until HH:MM". */
      untilText: string;
      /** The only button. */
      backText: string;
      contentDescription: string;
    };

export function lockoutViewModelFor(status: LockoutStatus, locale: Locale = DEFAULT_LOCALE): LockoutViewModel {
  if (!status.active) return { active: false };
  const untilText = t(locale, 'lockout.blockedUntil', { time: clockLabel(status.endsAt) });
  return {
    active: true,
    endsAt: status.endsAt,
    avatar: TIER_CATALOG[status.tier].avatar,
    accentColor: TIER_CATALOG[status.tier].textColor,
    title: tierLabel(status.tier, locale),
    untilText,
    backText: t(locale, 'lockout.back'),
    contentDescription: `${tierSentence(status.tier, locale)} ${untilText}`,
  };
}
