/** Where the system's "remove animations" setting comes from; React Native in the app. */
export interface ReducedMotionSource {
  isEnabled(): Promise<boolean>;
  /** Calls back on every change. Returns the unsubscribe function. */
  subscribe(listener: (enabled: boolean) => void): () => void;
}

/**
 * Reports the current reduced-motion setting and every later change (MASTER 7).
 * Returns the unsubscribe function. If the setting cannot be read, full motion stays.
 */
export function watchReducedMotion(
  source: ReducedMotionSource,
  onChange: (enabled: boolean) => void,
): () => void {
  source
    .isEnabled()
    .then(onChange)
    .catch(() => undefined);
  return source.subscribe(onChange);
}
