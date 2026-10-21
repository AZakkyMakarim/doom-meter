import { colors } from './tokens';
import { blend, contrastRatio } from './contrast';

/**
 * MASTER.md section 8 sets the thresholds: normal text 4.5:1, non-text (icons, borders,
 * severity) 3:1, against the surface the element sits on. Section 2.2 aims higher for the
 * Tier colors on the pill surface (7:1), met by the label text colors; the Doomed face grey
 * (#6B7280) is a face/border color only and needs 3:1.
 */
const TEXT = 4.5;
const NON_TEXT = 3;
const SEVERITY_TARGET = 7;

describe('contrastRatio (WCAG 2.x)', () => {
  it('is 21:1 for black on white and 1:1 for identical colors', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#34D399', '#0B0D14')).toBe(contrastRatio('#0B0D14', '#34D399'));
  });

  it('matches a published reference value', () => {
    // #767676 on white is the well-known smallest gray that passes AA (4.54:1).
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});

describe('blend', () => {
  it('mixes a foreground over a background by alpha', () => {
    expect(blend('#FFFFFF', '#000000', 0.5)).toBe('#808080');
    expect(blend('#34D399', '#0B0D14', 1)).toBe('#34D399');
  });
});

describe('Tier colors on the pill surface (MASTER 2.2, 8, 11)', () => {
  it.each([0, 1, 2, 3, 4])('Tier %i face color passes non-text contrast', (tier) => {
    expect(contrastRatio(colors.sev[tier], colors.overlayBg)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrastRatio(colors.sev[tier], colors.overlayBgAlt)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each([0, 1, 2, 3, 4])('Tier %i label text color meets the 7:1 target', (tier) => {
    expect(contrastRatio(colors.sevText[tier], colors.overlayBg)).toBeGreaterThanOrEqual(
      SEVERITY_TARGET,
    );
    expect(contrastRatio(colors.sevText[tier], colors.overlayBgAlt)).toBeGreaterThanOrEqual(TEXT);
  });

  it('the Brainrot brain pink reads on the pill surface', () => {
    expect(contrastRatio('#F9A8D4', colors.overlayBg)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each([1, 2, 3, 4])('the solid Tier %i border shows on a black video', (tier) => {
    expect(contrastRatio(colors.sev[tier], '#000000')).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('the opaque pill surface separates from a bright video', () => {
    expect(contrastRatio(colors.overlayBg, '#FFFFFF')).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('the Tier 0 border (40% opacity) is decorative: face and label carry the Tier', () => {
    const border = blend(colors.sev[0], colors.overlayBg, 0.4);
    expect(contrastRatio(border, colors.overlayBg)).toBeLessThan(NON_TEXT);
  });
});

describe('text on surfaces', () => {
  const surfaces = [
    ['pill surface', colors.overlayBg],
    ['panel rows', colors.overlayBgAlt],
    ['card', colors.card],
    ['app background', colors.appBg],
  ] as const;

  it.each(surfaces)('primary text on the %s', (_name, surface) => {
    expect(contrastRatio(colors.text, surface)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(surfaces)('muted text on the %s', (_name, surface) => {
    expect(contrastRatio(colors.textMuted, surface)).toBeGreaterThanOrEqual(TEXT);
  });

  it('muted text on the pill surface keeps the 7:1 MASTER promises', () => {
    expect(contrastRatio(colors.textMuted, colors.overlayBg)).toBeGreaterThanOrEqual(7);
  });

  it('text on a filled Tier badge or chip (onSev)', () => {
    for (const color of colors.sevText) {
      expect(contrastRatio(colors.onSev, color)).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('text on the primary button', () => {
    expect(contrastRatio(colors.onAction, colors.action)).toBeGreaterThanOrEqual(TEXT);
  });

  it('text on a filled Platform chip (onPlatform)', () => {
    for (const color of Object.values(colors.platform)) {
      expect(contrastRatio(colors.onPlatform, color)).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('Platform colors used as dots and bar fills read on the card and the panel rows', () => {
    for (const color of Object.values(colors.platform)) {
      expect(contrastRatio(color, colors.card)).toBeGreaterThanOrEqual(NON_TEXT);
      expect(contrastRatio(color, colors.overlayBgAlt)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it('input and secondary button outlines (borderStrong) are visible on cards', () => {
    expect(contrastRatio(colors.borderStrong, colors.card)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrastRatio(colors.borderStrong, colors.appBg)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrastRatio(colors.borderStrong, colors.overlayBgAlt)).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
  });
});
