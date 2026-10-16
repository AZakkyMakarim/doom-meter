/**
 * Layout decisions that depend on the system font scale (MASTER 4 and 8: support the
 * largest size without clipping; the count and time never truncate).
 */

/** From this scale on, seven narrow chart columns can no longer hold a value label. */
const CHART_ROWS_FROM_SCALE = 1.3;

export type WeekChartLayout = 'columns' | 'rows';

/** Seven columns normally; one labelled row per Day once text is large. */
export function weekChartLayoutFor(fontScale: number): WeekChartLayout {
  return Number.isFinite(fontScale) && fontScale >= CHART_ROWS_FROM_SCALE ? 'rows' : 'columns';
}

/**
 * The bottom navigation gives each label a third of the width, so its labels stop growing
 * here (like Material tab bars). Everything else scales without a cap.
 */
export const NAV_LABEL_MAX_FONT_SCALE = 1.4;
