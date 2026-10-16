import { PLATFORMS } from '../engine';
import type { EngineState, Platform, Tier } from '../engine';
import { formatClock, plural, spokenDuration } from '../format/duration';
import { INCOMPLETE_NOTE } from '../history/historyViewModel';
import { pillViewModelFor } from '../overlay/pillViewModel';
import type { NotCountingNotice } from '../permissions/permissionState';

/**
 * Everything the Today screen draws, derived from the Counting engine state
 * (MASTER.md sections 6.4 and 6.5). The screen holds no counting or copy rules.
 */

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Reels',
  youtube: 'Shorts',
  tiktok: 'TikTok',
};

export const EMPTY_MESSAGE = 'Nothing watched yet. Scroll as usual, DoomMeter keeps count.';

/** Platform names as the warning says them (CONTEXT.md), unlike the feed names on the rows. */
const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const ROW_WARNING = 'Detection not responding.';
const WARNING_WITH_USAGE_ACCESS =
  'Watch time still counts through Usage Access. Videos are not counted until it is back.';
const WARNING_WITHOUT_USAGE_ACCESS =
  'Nothing is counted until it is back. Usage Access would keep Watch time going.';

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
}

export interface PlatformRowViewModel {
  platform: Platform;
  /** Reels, Shorts, TikTok: text identity, never colour alone. */
  label: string;
  countText: string;
  timeText: string;
  /** Share of today's Watch time, 0-100. */
  sharePercent: number;
  shareText: string;
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
  /** One label for the whole summary block (MASTER 8). */
  summaryLabel: string;
}

export function todayViewModelFor(
  state: EngineState,
  options: TodayOptions = {},
): TodayViewModel {
  const usageAccess = options.usageAccess ?? false;
  const pill = pillViewModelFor(state);
  const { totals } = state;
  const rows = PLATFORMS.map((platform): PlatformRowViewModel => {
    const p = state.platforms[platform];
    const sharePercent =
      totals.watchTimeMs > 0 ? Math.round((p.watchTimeMs / totals.watchTimeMs) * 100) : 0;
    const label = PLATFORM_LABELS[platform];
    return {
      platform,
      label,
      countText: plural(p.watchedVideos, 'video'),
      timeText: formatClock(p.watchTimeMs),
      sharePercent,
      shareText: `${sharePercent}%`,
      warning: p.detectionHealthy ? null : ROW_WARNING,
      accessibilityLabel:
        `${label}. ${plural(p.watchedVideos, 'video')}, ${spokenDuration(p.watchTimeMs)}, ` +
        `${sharePercent} percent.` +
        (p.detectionHealthy ? '' : ` ${ROW_WARNING}`),
    };
  });
  const warnings = PLATFORMS.filter((platform) => !state.platforms[platform].detectionHealthy).map(
    (platform): DetectionWarningViewModel => {
      const title = `${PLATFORM_NAMES[platform]} detection is not responding`;
      const message = usageAccess ? WARNING_WITH_USAGE_ACCESS : WARNING_WITHOUT_USAGE_ACCESS;
      return { platform, title, message, accessibilityLabel: `Warning. ${title}. ${message}` };
    },
  );
  const incomplete = PLATFORMS.some((platform) => state.platforms[platform].incomplete);
  const incompleteNote = incomplete ? INCOMPLETE_NOTE : null;
  return {
    // A Day with failed detection is never "nothing watched": we do not know that.
    isEmpty: totals.watchedVideos === 0 && totals.watchTimeMs === 0 && !incomplete,
    warnings,
    incompleteNote,
    emptyMessage: EMPTY_MESSAGE,
    tier: state.tier,
    countText: pill.countText,
    unitText: pill.unitText,
    timeText: formatClock(totals.watchTimeMs),
    tierLabel: pill.labelText,
    avatar: pill.avatar,
    accentColor: pill.accentColor,
    rows,
    summaryLabel:
      `Today. ${plural(totals.watchedVideos, 'video')}, ${spokenDuration(totals.watchTimeMs)}. ` +
      pill.tierAnnouncement +
      (incompleteNote === null ? '' : ` ${incompleteNote}`),
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
