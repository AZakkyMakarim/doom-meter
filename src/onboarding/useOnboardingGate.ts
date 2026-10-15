import { useCallback, useEffect, useState } from 'react';
import { createAsyncStorageKeyValueStore } from '../storage/asyncStorageKeyValueStore';
import { createOnboardingStore } from './onboardingFlow';

const onboardingStore = createOnboardingStore(createAsyncStorageKeyValueStore());

export type OnboardingGate = 'loading' | 'onboarding' | 'done';

/** First-run gate: `loading` until the saved flag is read, then `onboarding` once per install. */
export function useOnboardingGate(): { gate: OnboardingGate; complete: () => void } {
  const [gate, setGate] = useState<OnboardingGate>('loading');

  useEffect(() => {
    let alive = true;
    onboardingStore
      .isCompleted()
      // If storage cannot be read, do not trap the user in onboarding.
      .catch(() => true)
      .then((completed) => {
        if (alive) setGate(completed ? 'done' : 'onboarding');
      });
    return () => {
      alive = false;
    };
  }, []);

  const complete = useCallback(() => {
    setGate('done');
    onboardingStore.markCompleted().catch(() => undefined);
  }, []);

  return { gate, complete };
}
