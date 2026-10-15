import { PLATFORMS } from '../engine';
import type { EngineState, Platform, Tier } from '../engine';
import { formatClock, plural, spokenDuration } from '../format/duration';
import { pillViewModelFor } from '../overlay/pillViewModel';

/**
 * Everything the Today screen draws, derived from the Counting engine state
 * (MASTER.md sections 6.4 and 6.5). The screen holds no counting or copy rules.
 */

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Reels',
  youtube: 'Shorts',
  tiktok: 'TikTok',
};

export const EMPTY_MESSAGE = 'Belum ada yang ditonton. Scroll seperti biasa, DoomMeter yang menghitung.';

const DETECTION_WARNING = 'Detection stopped responding. The count may be low.';

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

export function todayViewModelFor(state: EngineState): TodayViewModel {
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
      warning: p.detectionHealthy ? null : DETECTION_WARNING,
      accessibilityLabel:
        `${label}. ${plural(p.watchedVideos, 'video')}, ${spokenDuration(p.watchTimeMs)}, ` +
        `${sharePercent} percent.`,
    };
  });
  return {
    isEmpty: totals.watchedVideos === 0 && totals.watchTimeMs === 0,
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
      pill.tierAnnouncement,
  };
}
