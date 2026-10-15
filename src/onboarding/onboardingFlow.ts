import { permissionInfo } from '../permissions/permissionState';
import type { PermissionId, PermissionStatus } from '../permissions/permissionState';
import type { KeyValueStore } from '../storage';

/**
 * First-run onboarding: one step per permission (MASTER 6.5, PRD stories 47-52).
 * Required steps can still be skipped, because the app opens anyway and says it is not counting.
 */

export type OnboardingStep = 'intro' | PermissionId;

export const PRIVACY_STATEMENT = 'No data leaves your device. Only counts are kept, on this phone.';

const ORDER: readonly OnboardingStep[] = [
  'intro',
  'accessibility',
  'overlay',
  'usageAccess',
  'notifications',
];

/** Same steps on every first run, even if a permission is already on; notifications only where asked for. */
export function onboardingSteps(status: PermissionStatus): OnboardingStep[] {
  return ORDER.filter((step) => step !== 'notifications' || status.notificationsApplicable);
}

export interface OnboardingStepViewModel {
  step: OnboardingStep;
  title: string;
  body: string;
  /** "Required", "Optional", or null on the intro. */
  badge: 'Required' | 'Optional' | null;
  granted: boolean;
  /** `open` goes to the system settings screen, `next` moves on. */
  primaryAction: 'open' | 'next';
  primaryLabel: string;
  /** Secondary action that moves on without granting; null when there is nothing to skip. */
  skipLabel: string | null;
  footnote: string | null;
}

const OPEN_LABEL: Record<PermissionId, string> = {
  accessibility: 'Open Accessibility settings',
  overlay: 'Open Overlay settings',
  usageAccess: 'Open Usage access settings',
  notifications: 'Open Notification settings',
};

export function onboardingStepViewModel(
  step: OnboardingStep,
  status: PermissionStatus,
): OnboardingStepViewModel {
  if (step === 'intro') {
    return {
      step,
      title: 'Welcome to DoomMeter',
      body:
        'DoomMeter counts the short videos you watch and how long you spend on them. ' +
        'It needs a couple of permissions to do that. No data leaves your device.',
      badge: null,
      granted: false,
      primaryAction: 'next',
      primaryLabel: 'Get started',
      skipLabel: null,
      footnote: null,
    };
  }
  const info = permissionInfo(step);
  const granted = status[step];
  return {
    step,
    title: info.title,
    body: info.purpose,
    badge: info.required ? 'Required' : 'Optional',
    granted,
    primaryAction: granted ? 'next' : 'open',
    primaryLabel: granted ? 'Continue' : OPEN_LABEL[step],
    skipLabel: granted ? null : info.required ? 'Not now' : 'Skip',
    footnote: PRIVACY_STATEMENT,
  };
}

const COMPLETED_KEY = 'doommeter:onboarding:completed';

export interface OnboardingStore {
  isCompleted(): Promise<boolean>;
  markCompleted(): Promise<void>;
}

/** Remembers on this device that the first-run onboarding has been seen (finished or skipped). */
export function createOnboardingStore(store: KeyValueStore): OnboardingStore {
  return {
    async isCompleted() {
      return (await store.get(COMPLETED_KEY)) === '1';
    },
    async markCompleted() {
      await store.set(COMPLETED_KEY, '1');
    },
  };
}
