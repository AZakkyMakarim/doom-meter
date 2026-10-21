import { TIER_CATALOG } from '../design/catalog';
import type { EngineState } from '../engine';
import { dayEndFor } from '../engine/day';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { tierLabel, tierSentence } from '../i18n/text';
import { formatNumber, t } from '../i18n/translate';
import { formatTime, plural, spokenTime } from '../overlay/format';

/**
 * Everything the native Home widget draws, derived from the Counting engine state. Native keeps
 * a copy of the latest one on the device (so the widget survives a restart and the lock screen
 * can read the same numbers) and renders it; it holds no domain or design rules of its own.
 */

/** What the widget shows: a mood avatar, a title, and optionally the count and the time. */
export interface WidgetFace {
  /** Name of the mood avatar drawable. */
  avatar: string;
  /** Tier color for the title. */
  accentColor: string;
  /** The Tier label, or "No data yet" in the empty state. */
  title: string;
  /** Null in the empty state. */
  countText: string | null;
  unitText: string | null;
  timeText: string | null;
  contentDescription: string;
}

export interface WidgetViewModel {
  locale: Locale;
  /** The Day these numbers belong to. */
  day: string;
  /** Epoch ms at which the next Day begins. */
  dayEndsAt: number;
  /** Today's numbers, or the empty face when nothing has been counted yet. */
  face: WidgetFace;
  /** What native shows once `dayEndsAt` has passed with the app not running to send a new Day. */
  emptyFace: WidgetFace;
}

export interface WidgetOptions {
  /** From Settings; decides when the Day ends. */
  rolloverHour: number;
  locale?: Locale;
}

function emptyFaceFor(locale: Locale): WidgetFace {
  const title = t(locale, 'widget.empty');
  return {
    avatar: TIER_CATALOG[0].avatar,
    accentColor: TIER_CATALOG[0].textColor,
    title,
    countText: null,
    unitText: null,
    timeText: null,
    contentDescription: t(locale, 'widget.emptyDescription'),
  };
}

export function widgetViewModelFor(state: EngineState, options: WidgetOptions): WidgetViewModel {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const { tier, totals } = state;
  const emptyFace = emptyFaceFor(locale);
  const hasData = totals.watchedVideos > 0 || totals.watchTimeMs > 0;
  const { avatar, textColor } = TIER_CATALOG[tier];
  const face: WidgetFace = hasData
    ? {
        avatar,
        accentColor: textColor,
        title: tierLabel(tier, locale),
        countText: formatNumber(locale, totals.watchedVideos),
        unitText: t(locale, 'unit.video', { count: totals.watchedVideos }),
        timeText: formatTime(totals.watchTimeMs),
        contentDescription: t(locale, 'widget.description', {
          videos: plural(totals.watchedVideos, 'video', locale),
          time: spokenTime(totals.watchTimeMs, locale),
          tier: tierSentence(tier, locale),
        }),
      }
    : emptyFace;
  return {
    locale,
    day: state.day,
    dayEndsAt: dayEndFor(state.day, options.rolloverHour),
    face,
    emptyFace,
  };
}
