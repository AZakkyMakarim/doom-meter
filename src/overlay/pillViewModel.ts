import { colors } from '../design/tokens';
import type { EngineState, Tier } from '../engine';
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
  /** Spring on expanding and collapsing the panel. */
  panelSpring: boolean;
  /** 200ms border color crossfade on a Tier change. */
  borderCrossfade: boolean;
}

export function motionFlags(reducedMotion: boolean): MotionFlags {
  const on = !reducedMotion;
  return { pulse: on, numberRoll: on, scalePop: on, panelSpring: on, borderCrossfade: on };
}

export interface PillViewModel {
  tier: Tier;
  countText: string;
  unitText: string;
  timeText: string;
  labelText: string;
  /** Name of the mood avatar drawable (MASTER 2.1). */
  avatar: string;
  /** Tier color; also used for the label. */
  accentColor: string;
  borderColor: string;
  borderWidthDp: number;
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

interface TierStyle {
  label: string;
  avatar: string;
  borderWidthDp: number;
  heightDp: number;
  countSizeSp: number;
  avatarSizeDp: number;
  pulseMs: number | null;
  /** Haptic fired when entering this Tier. */
  haptic: Haptic;
}

const TIER_STYLES: readonly TierStyle[] = [
  {
    label: 'Fresh',
    avatar: 'mood_0_fresh',
    borderWidthDp: 1,
    heightDp: 44,
    countSizeSp: 20,
    avatarSizeDp: 32,
    pulseMs: null,
    haptic: 'none',
  },
  {
    label: 'Drifting',
    avatar: 'mood_1_drifting',
    borderWidthDp: 1.5,
    heightDp: 44,
    countSizeSp: 20,
    avatarSizeDp: 32,
    pulseMs: null,
    haptic: 'light',
  },
  {
    label: 'Doomed',
    avatar: 'mood_2_doomed',
    borderWidthDp: 2,
    heightDp: 48,
    countSizeSp: 22,
    avatarSizeDp: 36,
    pulseMs: 2400,
    haptic: 'medium',
  },
  {
    label: 'Cooked',
    avatar: 'mood_3_cooked',
    borderWidthDp: 2,
    heightDp: 52,
    countSizeSp: 24,
    avatarSizeDp: 40,
    pulseMs: 1600,
    haptic: 'heavy',
  },
  {
    label: 'Terminal',
    avatar: 'mood_4_terminal',
    borderWidthDp: 3,
    heightDp: 56,
    countSizeSp: 26,
    avatarSizeDp: 44,
    pulseMs: 900,
    haptic: 'heavyDouble',
  },
];

/** The Tier 0 border is drawn at 40% opacity (MASTER 2.2). */
const TIER_0_BORDER_ALPHA = '66';

/** The pill for one engine state, with no knowledge of what came before. */
export function pillViewModelFor(
  state: EngineState,
  options: PillOptions = {},
): PillViewModel {
  const { tier, totals } = state;
  const style = TIER_STYLES[tier];
  const accentColor = colors.sev[tier];
  const count = totals.watchedVideos;
  const tierAnnouncement = `Level ${tier + 1} of 5, ${style.label}.`;
  const reducedMotion = options.reducedMotion ?? false;
  return {
    tier,
    countText: `${count}`,
    unitText: count === 1 ? 'video' : 'videos',
    timeText: formatTime(totals.watchTimeMs),
    labelText: style.label,
    avatar: style.avatar,
    accentColor,
    borderColor: tier === 0 ? `#${TIER_0_BORDER_ALPHA}${accentColor.slice(1)}` : accentColor,
    borderWidthDp: style.borderWidthDp,
    heightDp: style.heightDp,
    countSizeSp: style.countSizeSp,
    avatarSizeDp: style.avatarSizeDp,
    pulseMs: reducedMotion ? null : style.pulseMs,
    motion: motionFlags(reducedMotion),
    surfaceColor: colors.overlayBg,
    textColor: colors.text,
    mutedTextColor: colors.textMuted,
    contentDescription:
      `Doom meter. ${plural(count, 'video')}, ${spokenTime(totals.watchTimeMs)}. ` +
      tierAnnouncement,
    tierAnnouncement,
    announcement: null,
    tierChange: 'none',
    haptic: 'none',
    compact: options.compact ?? false,
    dragRangeDp: DRAG_RANGE_DP,
    positionDp: Math.min(DRAG_RANGE_DP, Math.max(0, options.positionDp ?? 0)),
    panel: panelViewModelFor(state),
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
