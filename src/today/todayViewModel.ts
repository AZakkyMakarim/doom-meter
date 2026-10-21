import { platformHeaderLayoutFor } from '../design/fontScale';
import type { PlatformHeaderLayout } from '../design/fontScale';
import { PLATFORMS, PLATFORM_BY_ID } from '../design/catalog';
import type { Platform } from '../design/catalog';
import type { EngineState, Tier } from '../engine';
import { formatClock, plural, spokenDuration } from '../format/duration';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translate';
import { pillViewModelFor } from '../overlay/pillViewModel';
import type { NotCountingNotice } from '../permissions/permissionState';

/**
 * Everything the Today screen draws, derived from the Counting engine state
 * (MASTER.md sections 6.4 and 6.5). The screen holds no counting or copy rules.
 */

export interface DetectionWarningViewModel {
  platform: Platform;
  /** Names the Platform: "TikTok detection is not responding". */
  title: string;
  message: string;
  /** Title and message as one sentence group, led by "Warning" so colour is never the only cue. */
  accessibilityLabel: string;
}

export interface TodayOptions {
  /** Whether Usage Access is granted, which decides what the warning promises. Default false. */
  usageAccess?: boolean;
  /** The language of every text. Default English. */
  locale?: Locale;
  /** System font scale and window width in dp, which decide the Platform header layout. */
  fontScale?: number;
  width?: number;
}

export interface PlatformRowViewModel {
  platform: Platform;
  /** Reels, Shorts, TikTok: text identity, never colour alone. */
  label: string;
  /** The bare number; the tile label carries the unit. */
  countText: string;
  timeText: string;
  warning: string | null;
  accessibilityLabel: string;
}

export interface TodayViewModel {
  /** Nothing watched yet today: show the empty state, not zeros. */
  isEmpty: boolean;
  /** One warning per Platform whose detection is not responding right now. */
  warnings: DetectionWarningViewModel[];
  /** Set once detection failed for any Platform today; stays set after it recovers. */
  incompleteNote: string | null;
  emptyMessage: string;
  tier: Tier;
  countText: string;
  unitText: string;
  timeText: string;
  tierLabel: string;
  /** Name of the mood avatar drawable (MASTER 2.1). */
  avatar: string;
  accentColor: string;
  rows: PlatformRowViewModel[];
  /** One row of four equal tiles, or a 2x2 grid when text is large or the screen narrow. */
  platformLayout: PlatformHeaderLayout;
  /** One label for the whole summary block (MASTER 8). */
  summaryLabel: string;
}

export function todayViewModelFor(
  state: EngineState,
  options: TodayOptions = {},
): TodayViewModel {
  const usageAccess = options.usageAccess ?? false;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const pill = pillViewModelFor(state, { locale });
  const rowWarning = t(locale, 'today.rowWarning');
  const { totals } = state;
  const rows = PLATFORMS.map((platform): PlatformRowViewModel => {
    const p = state.platforms[platform];
    const { label, name } = PLATFORM_BY_ID[platform];
    return {
      platform,
      label,
      countText: `${p.watchedVideos}`,
      timeText: formatClock(p.watchTimeMs),
      warning: p.detectionHealthy ? null : rowWarning,
      accessibilityLabel:
        t(locale, 'today.tileLabel', {
          name,
          videos: plural(p.watchedVideos, 'video', locale),
          time: spokenDuration(p.watchTimeMs, locale),
        }) + (p.detectionHealthy ? '' : ` ${rowWarning}`),
    };
  });
  const warnings = PLATFORMS.filter((platform) => !state.platforms[platform].detectionHealthy).map(
    (platform): DetectionWarningViewModel => {
      const title = t(locale, 'today.warningTitle', { name: PLATFORM_BY_ID[platform].name });
      const message = t(
        locale,
        usageAccess ? 'today.warningWithUsageAccess' : 'today.warningWithoutUsageAccess',
      );
      return {
        platform,
        title,
        message,
        accessibilityLabel: t(locale, 'today.warningLabel', { title, message }),
      };
    },
  );
  const incomplete = PLATFORMS.some((platform) => state.platforms[platform].incomplete);
  const incompleteNote = incomplete ? t(locale, 'history.incomplete') : null;
  return {
    // A Day with failed detection is never "nothing watched": we do not know that.
    isEmpty: totals.watchedVideos === 0 && totals.watchTimeMs === 0 && !incomplete,
    warnings,
    incompleteNote,
    emptyMessage: t(locale, 'today.empty'),
    tier: state.tier,
    countText: pill.countText,
    unitText: pill.unitText,
    timeText: formatClock(totals.watchTimeMs),
    tierLabel: pill.labelText,
    avatar: pill.avatar,
    accentColor: pill.accentColor,
    rows,
    platformLayout: platformHeaderLayoutFor(options.fontScale ?? 1, options.width ?? 360),
    summaryLabel:
      t(locale, 'today.summary', {
        videos: plural(totals.watchedVideos, 'video', locale),
        time: spokenDuration(totals.watchTimeMs, locale),
        tier: pill.tierAnnouncement,
      }) + (incompleteNote === null ? '' : ` ${incompleteNote}`),
  };
}

/**
 * Whether the empty state offers the "Enable overlay" action (ADR 0006). It is a way to switch the
 * pill on, so it shows only while the pill is off: on a fresh install the pill is on by default and
 * the button would be misleading. A missing permission shows its own notice instead of the action.
 */
export function showsEnableOverlayAction(options: {
  overlayActive: boolean;
  notCountingNotice: NotCountingNotice | null;
}): boolean {
  return !options.overlayActive && options.notCountingNotice === null;
}
