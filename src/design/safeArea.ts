/** System window insets in dp: status bar, camera cutout and gesture bar (MASTER 8). */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export interface ScreenPadding {
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

/**
 * Screen padding that keeps content clear of the system bars and cutouts. The app draws
 * edge to edge, so the insets are added to the design padding. Before the native insets are
 * known, the status bar height still keeps the top clear.
 */
export function safeAreaPadding(
  insets: Insets,
  base: { top: number; bottom: number; horizontal: number },
  statusBarHeight: number,
  includeBottom = true,
): ScreenPadding {
  return {
    paddingTop: base.top + Math.max(insets.top, statusBarHeight),
    paddingBottom: base.bottom + (includeBottom ? insets.bottom : 0),
    paddingLeft: base.horizontal + insets.left,
    paddingRight: base.horizontal + insets.right,
  };
}
