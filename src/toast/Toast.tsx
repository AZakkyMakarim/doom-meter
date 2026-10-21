import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { TIER_CATALOG } from '../design/catalog';
import { colors } from '../design/tokens';
import { useLocale } from '../i18n/LocaleContext';
import { translate } from '../i18n/translate';
import { watchReducedMotion } from '../overlay/reducedMotion';
import { createToastStore } from './toastStore';
import type { Toast as ToastData } from './toastStore';

/** The app's one toast store; screens call `toasts.show(...)`, `<ToastHost />` draws it. */
export const toasts = createToastStore();

const FADE_MS = 120; // --dur-fast

function useCurrentToast(): ToastData | null {
  const [current, setCurrent] = useState(() => toasts.get());
  useEffect(() => {
    setCurrent(toasts.get());
    return toasts.subscribe(setCurrent);
  }, []);
  return current;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(
    () =>
      watchReducedMotion(
        {
          isEnabled: () => AccessibilityInfo.isReduceMotionEnabled(),
          subscribe: (listener) => {
            const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', listener);
            return () => sub.remove();
          },
        },
        setReduced,
      ),
    [],
  );
  return reduced;
}

/**
 * In-app toast (not the Android one). Place it right above the bottom bar: it takes no
 * layout space, ignores touches so no control is blocked, and a polite live region
 * announces it without moving focus (MASTER 8). Fades in; appears at once under reduced motion.
 */
export function ToastHost() {
  const toast = useCurrentToast();
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const id = toast?.id;

  useEffect(() => {
    if (id === undefined || reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
  }, [id, reducedMotion, opacity]);

  return (
    <View pointerEvents="none" style={styles.anchor} accessibilityLiveRegion="polite">
      {toast !== null && (
        <Animated.View
          key={toast.id}
          style={[styles.toast, toast.variant === 'failure' ? styles.failure : styles.success, { opacity }]}>
          {toast.variant === 'failure' && (
            // Decorative: the words carry the meaning, the Washed (red) face carries the mood.
            <Image
              source={{ uri: TIER_CATALOG[2].avatar }}
              style={styles.icon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          )}
          <Text style={styles.text}>{translate(locale, toast.message)}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Zero height, so the toast rests on the top edge of the bar below it without moving anything.
  anchor: {
    height: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    zIndex: 1,
  },
  toast: {
    position: 'absolute',
    bottom: 16,
    maxWidth: '90%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.overlayBg,
  },
  success: {
    borderColor: colors.sev[0],
  },
  // Washed (Tier 2) is the red Tier.
  failure: {
    borderColor: colors.sev[2],
  },
  icon: {
    width: 24,
    height: 24,
  },
  text: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
