import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translate';
import { permissionInfo } from '../permissions/permissionState';
import type { PermissionId, PermissionStatus } from '../permissions/permissionState';
import type { KeyValueStore } from '../storage';

/**
 * First-run onboarding: one step per permission (MASTER 6.5, PRD stories 47-52).
 * Required steps can still be skipped, because the app opens anyway and says it is not counting.
 */

export type OnboardingStep = 'intro' | PermissionId;

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
  /** "Required" or "Optional" in the language shown, or null on the intro. */
  badge: string | null;
  granted: boolean;
  /** `open` goes to the system settings screen, `next` moves on. */
  primaryAction: 'open' | 'next';
  primaryLabel: string;
  /** Secondary action that moves on without granting; null when there is nothing to skip. */
  skipLabel: string | null;
  footnote: string | null;
}

export function onboardingStepViewModel(
  step: OnboardingStep,
  status: PermissionStatus,
  locale: Locale = DEFAULT_LOCALE,
): OnboardingStepViewModel {
  if (step === 'intro') {
    return {
      step,
      title: t(locale, 'onboarding.welcomeTitle'),
      body: t(locale, 'onboarding.welcomeBody'),
      badge: null,
      granted: false,
      primaryAction: 'next',
      primaryLabel: t(locale, 'onboarding.getStarted'),
      skipLabel: null,
      footnote: null,
    };
  }
  const info = permissionInfo(step, locale);
  const granted = status[step];
  return {
    step,
    title: info.title,
    body: info.purpose,
    badge: t(locale, info.required ? 'permission.required' : 'permission.optional'),
    granted,
    primaryAction: granted ? 'next' : 'open',
    primaryLabel: t(locale, granted ? 'onboarding.continue' : `onboarding.open.${step}`),
    skipLabel: granted ? null : t(locale, info.required ? 'onboarding.notNow' : 'onboarding.skip'),
    footnote: t(locale, 'onboarding.privacy'),
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
