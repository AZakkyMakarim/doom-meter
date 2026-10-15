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
  /** Pulse period of the avatar in ms, or null when the Tier does not pulse. */
  pulseMs: number | null;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  /** One screen reader label for the whole pill (MASTER 8). */
  contentDescription: string;
  /** Spoken once when the Tier changes; the only thing ever announced (MASTER 8). */
  tierAnnouncement: string;
  /** How the Tier moved since the previous update; native animates once on a change. */
  tierChange: TierChange;
  /** Haptic to fire now; only set when the Tier increased. */
  haptic: Haptic;
  /** Compact mode: the pill shows the avatar and count only (MASTER 6.1). */
  compact: boolean;
  /** How far the pill may be dragged down from its top-edge anchor, in dp. */
  dragRangeDp: number;
  /** The expanded panel opened by tapping the pill (MASTER 6.2). */
  panel: PanelViewModel;
}

export interface PillOptions {
  compact?: boolean;
}

/**
 * User preferences the presenter applies when a caller passes no options. The Settings
 * screen switches compact mode here, so the detection runner needs no change.
 */
const pillPreferences: PillOptions = { compact: false };

export function setCompactMode(compact: boolean): void {
  pillPreferences.compact = compact;
}

export function isCompactMode(): boolean {
  return pillPreferences.compact ?? false;
}

/** The pill hugs the top edge: dragging moves it vertically within this band (MASTER 6.1). */
const DRAG_RANGE_DP = 160;

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
    pulseMs: style.pulseMs,
    surfaceColor: colors.overlayBg,
    textColor: colors.text,
    mutedTextColor: colors.textMuted,
    contentDescription:
      `Doom meter. ${plural(count, 'video')}, ${spokenTime(totals.watchTimeMs)}. ` +
      tierAnnouncement,
    tierAnnouncement,
    tierChange: 'none',
    haptic: 'none',
    compact: options.compact ?? false,
    dragRangeDp: DRAG_RANGE_DP,
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
    const pill = pillViewModelFor(state, options ?? pillPreferences);
    if (previous !== null && pill.tier !== previous) {
      const increased = pill.tier > previous;
      pill.tierChange = increased ? 'increase' : 'decrease';
      pill.haptic = increased ? TIER_STYLES[pill.tier].haptic : 'none';
    }
    previous = pill.tier;
    return pill;
  };
}
