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
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  onSev: '#0B0D14',
  action: '#F8FAFC',
  onAction: '#0B0D14',
  focusRing: '#FFFFFF',
  sev: ['#34D399', '#FACC15', '#FB923C', '#F87171', '#FF4D8D'],
} as const;
