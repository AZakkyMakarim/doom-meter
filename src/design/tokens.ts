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
  platform: { instagram: '#E1306C', youtube: '#FF3D3D', tiktok: '#25F4EE' },
  sev: ['#34D399', '#FACC15', '#FB923C', '#F87171', '#FF4D8D'],
} as const;
