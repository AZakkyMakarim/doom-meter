import { NAV_LABEL_MAX_FONT_SCALE, weekChartLayoutFor } from './fontScale';
import { NO_INSETS, safeAreaPadding } from './safeArea';

describe('7-day chart layout by font scale (MASTER 8, 11)', () => {
  it('keeps seven columns at the default and moderately large sizes', () => {
    expect(weekChartLayoutFor(1)).toBe('columns');
    expect(weekChartLayoutFor(1.15)).toBe('columns');
  });

  it('switches to one labelled row per Day before the columns would clip', () => {
    expect(weekChartLayoutFor(1.3)).toBe('rows');
    expect(weekChartLayoutFor(2)).toBe('rows');
  });

  it('treats a missing or broken scale as the default', () => {
    expect(weekChartLayoutFor(0)).toBe('columns');
    expect(weekChartLayoutFor(Number.NaN)).toBe('columns');
  });

  it('caps only the bottom navigation labels, which have a fixed third of the width', () => {
    expect(NAV_LABEL_MAX_FONT_SCALE).toBeGreaterThanOrEqual(1.3);
    expect(NAV_LABEL_MAX_FONT_SCALE).toBeLessThanOrEqual(1.5);
  });
});

describe('safeAreaPadding (MASTER 8, 11)', () => {
  const base = { top: 24, bottom: 48, horizontal: 16 };

  it('adds the system insets to the screen padding', () => {
    expect(
      safeAreaPadding({ top: 32, bottom: 24, left: 0, right: 0 }, base, 0),
    ).toEqual({ paddingTop: 56, paddingBottom: 72, paddingLeft: 16, paddingRight: 16 });
  });

  it('leaves the bottom inset to a bottom bar when asked', () => {
    expect(
      safeAreaPadding({ top: 0, bottom: 24, left: 0, right: 0 }, base, 0, false).paddingBottom,
    ).toBe(48);
  });

  it('keeps content out of a side cutout in landscape', () => {
    expect(
      safeAreaPadding({ top: 0, bottom: 0, left: 48, right: 0 }, base, 0),
    ).toMatchObject({ paddingLeft: 64, paddingRight: 16 });
  });

  it('falls back to the status bar height when insets are not known yet', () => {
    expect(safeAreaPadding(NO_INSETS, base, 28).paddingTop).toBe(52);
  });

  it('prefers the larger of the measured top inset and the status bar height', () => {
    expect(safeAreaPadding({ ...NO_INSETS, top: 40 }, base, 28).paddingTop).toBe(64);
    expect(safeAreaPadding({ ...NO_INSETS, top: 20 }, base, 28).paddingTop).toBe(52);
  });
});
