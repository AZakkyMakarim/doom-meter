import { TIER_CATALOG } from '../design/catalog';
import { colors } from '../design/tokens';
import type { EngineState, Tier } from '../engine';
import { formatNumber, t } from '../i18n/translate';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { tierLabel, tierSentence } from '../i18n/text';
import { formatTime, plural, spokenTime } from './format';
import { panelViewModelFor } from './panelViewModel';
import type { PanelViewModel } from './panelViewModel';

/**
 * Everything the native Overlay pill needs to draw itself, derived from the
 * Counting engine state. Native code renders this and holds no domain or
 * design rules of its own (MASTER.md sections 2, 3, 4, 6.1).
 */

export type Haptic = 'none' | 'light' | 'medium' | 'heavy' | 'heavyDouble';
export type TierChange = 'none' | 'increase' | 'decrease';

/**
 * Which animations native may play (MASTER 7). Under reduced motion every one is off:
 * the Tier change is an instant swap and only the haptic is kept.
 */
export interface MotionFlags {
  /** Avatar pulse on Tier 2 and above. */
  pulse: boolean;
  /** 120ms count roll on a new video. */
  numberRoll: boolean;
  /** Avatar scale pop on a Tier change. */
  scalePop: boolean;
  /** Panel grows down on open (about 220ms) and shrinks up on close (about 150ms). */
  panelGrow: boolean;
}

export function motionFlags(reducedMotion: boolean): MotionFlags {
  const on = !reducedMotion;
  return { pulse: on, numberRoll: on, scalePop: on, panelGrow: on };
}

export interface PillViewModel {
  tier: Tier;
  countText: string;
  unitText: string;
  timeText: string;
  labelText: string;
  /** What a screen reader hears as the pill's state while it is closed (the panel is the other state). */
  collapsedLabel: string;
  /** Name of the mood avatar drawable (MASTER 2.1). */
  avatar: string;
  /** Tier color; also used for the label. */
  accentColor: string;
  /** Small Tier-colored dot beside the label; the pill has no border (MASTER 6.1). */
  accentDotColor: string;
  /** Corner radius of the pill and the panel. */
  cornerRadiusDp: number;
  verticalPaddingDp: number;
  /** Avatar plus the vertical padding on both sides. */
  heightDp: number;
  countSizeSp: number;
  avatarSizeDp: number;
  /** Pulse period of the avatar in ms, or null when the Tier does not pulse or motion is reduced. */
  pulseMs: number | null;
  motion: MotionFlags;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  /** One screen reader label for the whole pill (MASTER 8). */
  contentDescription: string;
  /** The Tier on its own, e.g. "Level 3 of 5, Doomed.", also the tail of the pill label. */
  tierAnnouncement: string;
  /**
   * What native speaks right now: the Tier sentence on a Tier change, otherwise null.
   * It is never set for a new video or a time update (MASTER 8).
   */
  announcement: string | null;
  /** How the Tier moved since the previous update; native animates once on a change. */
  tierChange: TierChange;
  /** Haptic to fire now; only set when the Tier increased. */
  haptic: Haptic;
  /** Compact mode: the pill shows the avatar and count only (MASTER 6.1). */
  compact: boolean;
  /** How far the pill may be dragged down from its top-edge anchor, in dp. */
  dragRangeDp: number;
  /** Where the pill sits below its top-edge anchor, in dp (the Settings position). */
  positionDp: number;
  /** The expanded panel opened by tapping the pill (MASTER 6.2). */
  panel: PanelViewModel;
}

export interface PillOptions {
  compact?: boolean;
  /** Haptic on entering a higher Tier. Default true. */
  haptics?: boolean;
  /** Position below the top-edge anchor in dp. Default 0. */
  positionDp?: number;
  /** The system asked to remove animations (MASTER 7). Default false. */
  reducedMotion?: boolean;
  /** The language of every text on the pill and its panel. Default English. */
  locale?: Locale;
}

/**
 * User preferences the presenter applies when a caller passes no options. Settings
 * writes them here, so the detection runner needs no change.
 */
const pillPreferences: PillOptions = {
  compact: false,
  haptics: true,
  positionDp: 0,
  reducedMotion: false,
  locale: DEFAULT_LOCALE,
};

export function setPillPreferences(preferences: PillOptions): void {
  Object.assign(pillPreferences, preferences);
}

export function setCompactMode(compact: boolean): void {
  pillPreferences.compact = compact;
}

export function isCompactMode(): boolean {
  return pillPreferences.compact ?? false;
}

/** The pill hugs the top edge: dragging moves it vertically within this band (MASTER 6.1). */
export const PILL_DRAG_RANGE_DP = 160;
const DRAG_RANGE_DP = PILL_DRAG_RANGE_DP;

/** Pill sizing and motion per Tier; the Tier's name, avatar and color live in the catalog. */
interface TierStyle {
  countSizeSp: number;
  avatarSizeDp: number;
  pulseMs: number | null;
  /** Haptic fired when entering this Tier. */
  haptic: Haptic;
}

const TIER_STYLES: readonly TierStyle[] = [
  {
    countSizeSp: 20,
    avatarSizeDp: 32,
    pulseMs: null,
    haptic: 'none',
  },
  {
    countSizeSp: 20,
    avatarSizeDp: 32,
    pulseMs: null,
    haptic: 'light',
  },
  {
    countSizeSp: 22,
    avatarSizeDp: 36,
    pulseMs: 2400,
    haptic: 'medium',
  },
  {
    countSizeSp: 24,
    avatarSizeDp: 40,
    pulseMs: 1600,
    haptic: 'heavy',
  },
  {
    countSizeSp: 26,
    avatarSizeDp: 44,
    pulseMs: 900,
    haptic: 'heavyDouble',
  },
];

const CORNER_RADIUS_DP = 20;
const VERTICAL_PADDING_DP = 14;

/** The pill for one engine state, with no knowledge of what came before. */
export function pillViewModelFor(
  state: EngineState,
  options: PillOptions = {},
): PillViewModel {
  const { tier, totals } = state;
  const style = TIER_STYLES[tier];
  const { avatar, color, textColor: accentColor } = TIER_CATALOG[tier];
  const locale = options.locale ?? DEFAULT_LOCALE;
  const count = totals.watchedVideos;
  const tierAnnouncement = tierSentence(tier, locale);
  const reducedMotion = options.reducedMotion ?? false;
  return {
    tier,
    countText: formatNumber(locale, count),
    unitText: t(locale, 'unit.video', { count }),
    timeText: formatTime(totals.watchTimeMs),
    labelText: tierLabel(tier, locale),
    collapsedLabel: t(locale, 'pill.collapsed'),
    avatar,
    accentColor,
    accentDotColor: color,
    cornerRadiusDp: CORNER_RADIUS_DP,
    verticalPaddingDp: VERTICAL_PADDING_DP,
    heightDp: style.avatarSizeDp + 2 * VERTICAL_PADDING_DP,
    countSizeSp: style.countSizeSp,
    avatarSizeDp: style.avatarSizeDp,
    pulseMs: reducedMotion ? null : style.pulseMs,
    motion: motionFlags(reducedMotion),
    surfaceColor: colors.overlayBg,
    textColor: colors.text,
    mutedTextColor: colors.textMuted,
    contentDescription: t(locale, 'pill.description', {
      videos: plural(count, 'video', locale),
      time: spokenTime(totals.watchTimeMs, locale),
      tier: tierAnnouncement,
    }),
    tierAnnouncement,
    announcement: null,
    tierChange: 'none',
    haptic: 'none',
    compact: options.compact ?? false,
    dragRangeDp: DRAG_RANGE_DP,
    positionDp: Math.min(DRAG_RANGE_DP, Math.max(0, options.positionDp ?? 0)),
    panel: panelViewModelFor(state, locale),
  };
}

/**
 * Remembers the previous Tier so each update says whether the Tier moved.
 * Animations and haptics fire only on a Tier change, never per video.
 */
export function createPillPresenter(): (state: EngineState, options?: PillOptions) => PillViewModel {
  let previous: Tier | null = null;
  return (state, options) => {
    const applied = options ?? pillPreferences;
    const pill = pillViewModelFor(state, applied);
    if (previous !== null && pill.tier !== previous) {
      const increased = pill.tier > previous;
      pill.tierChange = increased ? 'increase' : 'decrease';
      pill.announcement = pill.tierAnnouncement;
      pill.haptic = increased && applied.haptics !== false ? TIER_STYLES[pill.tier].haptic : 'none';
    }
    previous = pill.tier;
    return pill;
  };
}
