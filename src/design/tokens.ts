import { PLATFORM_CATALOG, TIER_CATALOG } from './catalog';
import type { Platform } from './catalog';

/**
 * Design tokens from design-system/doommeter/MASTER.md section 3.
 * The only place raw hex lives; components and the native overlay receive these values.
 */
export const colors = {
  overlayBg: '#0B0D14',
  overlayBgAlt: '#151925',
  appBg: '#020617',
  card: '#0E1223',
  border: '#334155',
  /**
   * Outline of interactive controls (inputs, secondary buttons): 3:1 on cards, which the
   * decorative `border` (1.8:1) is not. Added by the accessibility pass; MASTER 8 asks for
   * 3:1 on non-text boundaries.
   */
  borderStrong: '#64748B',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  onSev: '#0B0D14',
  /** Text on a filled Platform chip; the dark surface color misses 4.5:1 on Reels (4.47:1). */
  onPlatform: '#000000',
  action: '#F8FAFC',
  onAction: '#0B0D14',
  focusRing: '#FFFFFF',
  /** Platform chip colors (MASTER 3); always paired with a label. */
  platform: Object.fromEntries(PLATFORM_CATALOG.map((p) => [p.id, p.color])) as Record<
    Platform,
    string
  >,
  /** Tier colors, indexed by Tier. */
  sev: TIER_CATALOG.map((t) => t.color) as readonly string[],
  /** Tier colors for label text and filled badges, indexed by Tier (>= 4.5:1 both ways). */
  sevText: TIER_CATALOG.map((t) => t.textColor) as readonly string[],
};
