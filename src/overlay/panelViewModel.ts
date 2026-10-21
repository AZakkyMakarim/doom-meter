import { PLATFORMS, PLATFORM_BY_ID, TIER_CATALOG, tierSentence } from '../design/catalog';
import { colors } from '../design/tokens';
import type { Platform } from '../design/catalog';
import type { EngineState } from '../engine';
import { formatTime, plural, spokenTime } from './format';

/**
 * Everything the native expanded panel needs to draw itself (MASTER 6.2).
 * Native renders this and holds no domain or design rules of its own.
 */

export interface PlatformRowViewModel {
  platform: Platform;
  /** Chip label. Not the official brand name where the Platform has a feature name. */
  label: string;
  /** Platform chip color; always paired with the label (MASTER 3). */
  color: string;
  countText: string;
  unitText: string;
  timeText: string;
  /** Share of total Watch time, 0-100. Rounded shares add up to 100. */
  percent: number;
  /** Numeric label for the proportion bar, so the bar is never color-only. */
  percentText: string;
  contentDescription: string;
}

export interface PanelViewModel {
  /** Name of the mood avatar drawable, shown large. */
  avatar: string;
  avatarSizeDp: number;
  tierName: string;
  accentColor: string;
  countText: string;
  unitText: string;
  timeText: string;
  /** The Day context; there is no manual reset (CONTEXT.md, Day). */
  dayText: string;
  closeLabel: string;
  rows: PlatformRowViewModel[];
  surfaceColor: string;
  /** Background of rows and chips. */
  rowColor: string;
  /** Text on a filled Platform chip: at least 4.5:1 on every Platform color. */
  chipTextColor: string;
  textColor: string;
  mutedTextColor: string;
  /** Panel width, clamped by native to the screen. */
  widthDp: number;
  /** In landscape the panel never grows past this fraction of the screen height, then scrolls. */
  landscapeMaxHeightFraction: number;
  contentDescription: string;
}

const PANEL_AVATAR_DP = 96;
const PANEL_WIDTH_DP = 360;
const LANDSCAPE_MAX_HEIGHT_FRACTION = 0.6;

/**
 * Whole-number shares of `values` that add up to exactly 100 (largest remainder),
 * so the bar labels never read 33 + 33 + 33. All zeros when the total is zero.
 */
function shares(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map(v => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, rest: e - floors[i] }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

export function panelViewModelFor(state: EngineState): PanelViewModel {
  const { tier, totals } = state;
  const percents = shares(PLATFORMS.map(p => state.platforms[p].watchTimeMs));
  const rows = PLATFORMS.map((platform, i): PlatformRowViewModel => {
    const { watchedVideos, watchTimeMs } = state.platforms[platform];
    const { label, color } = PLATFORM_BY_ID[platform];
    return {
      platform,
      label,
      color,
      countText: `${watchedVideos}`,
      unitText: watchedVideos === 1 ? 'video' : 'videos',
      timeText: formatTime(watchTimeMs),
      percent: percents[i],
      percentText: `${percents[i]}%`,
      contentDescription:
        `${label}, ${plural(watchedVideos, 'video')}, ${spokenTime(
          watchTimeMs,
        )}, ` + `${percents[i]} percent`,
    };
  });
  const count = totals.watchedVideos;
  const { label: tierName, avatar, color: accentColor } = TIER_CATALOG[tier];
  return {
    avatar,
    avatarSizeDp: PANEL_AVATAR_DP,
    tierName,
    accentColor,
    countText: `${count}`,
    unitText: count === 1 ? 'video' : 'videos',
    timeText: formatTime(totals.watchTimeMs),
    dayText: 'Today',
    closeLabel: 'Close',
    rows,
    surfaceColor: colors.overlayBg,
    rowColor: colors.overlayBgAlt,
    chipTextColor: colors.onPlatform,
    textColor: colors.text,
    mutedTextColor: colors.textMuted,
    widthDp: PANEL_WIDTH_DP,
    landscapeMaxHeightFraction: LANDSCAPE_MAX_HEIGHT_FRACTION,
    contentDescription:
      `Doom meter details for today. ${plural(count, 'video')}, ` +
      `${spokenTime(totals.watchTimeMs)}. ${tierSentence(tier)}`,
  };
}
