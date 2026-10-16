/**
 * WCAG 2.x contrast math for the design tokens (MASTER.md section 8 and the section 11
 * checklist). Pure functions; the token test asserts the thresholds with them.
 */

function channels(hex: string): [number, number, number] {
  const channel = (from: number) => parseInt(hex.slice(from, from + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a `#RRGGBB` color. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast ratio between two `#RRGGBB` colors, 1 to 21, in either order. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `foreground` drawn over `background` at `alpha` (0-1), as an opaque `#RRGGBB`. */
export function blend(foreground: string, background: string, alpha: number): string {
  const f = channels(foreground);
  const b = channels(background);
  const mixed = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return `#${mixed
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
