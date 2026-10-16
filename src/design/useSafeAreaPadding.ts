import { useEffect, useState } from 'react';
import { AppState, NativeModules, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { NO_INSETS, safeAreaPadding } from './safeArea';
import type { Insets, ScreenPadding } from './safeArea';

interface NativeInsetsModule {
  getInsets(): Promise<Insets>;
}

const native: NativeInsetsModule | undefined =
  Platform.OS === 'android' ? NativeModules.DoomMeterInsets : undefined;

/** Insets are re-read after a rotation settles and whenever the app returns to the front. */
const SETTLE_MS = 350;

function useInsets(): Insets {
  const { width, height } = useWindowDimensions();
  const [insets, setInsets] = useState<Insets>(NO_INSETS);

  useEffect(() => {
    if (!native) return undefined;
    let live = true;
    const read = () =>
      native
        .getInsets()
        .then((next) => live && setInsets(next))
        .catch(() => undefined);
    read();
    const settle = setTimeout(read, SETTLE_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      live = false;
      clearTimeout(settle);
      sub.remove();
    };
  }, [width, height]);

  return insets;
}

/** Padding for a full-screen scroll area: design padding plus the system bars and cutouts. */
export function useSafeAreaPadding(
  base: { top: number; bottom: number; horizontal: number },
  includeBottom = true,
): ScreenPadding {
  const insets = useInsets();
  return safeAreaPadding(insets, base, StatusBar.currentHeight ?? 0, includeBottom);
}

/** The raw system insets, for a bottom bar that owns the gesture-bar space itself. */
export function useSystemInsets(): Insets {
  return useInsets();
}
