import { TIER_CATALOG } from '../design/catalog';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import type { MessageId } from '../i18n/messages.en';
import { tierLabel } from '../i18n/text';
import { t } from '../i18n/translate';
import { permissionInfo } from '../permissions/permissionState';
import type { PermissionId, PermissionStatus } from '../permissions/permissionState';
import type { KeyValueStore } from '../storage';

/**
 * First-run onboarding: one step per permission (MASTER 6.5, PRD stories 47-52).
 * Required steps can still be skipped, because the app opens anyway and says it is not counting.
 */

/** `intro` explains how counting works; `tiers`, `privacy` and `calculator` are the other info screens. */
export type InfoStep = 'intro' | 'tiers' | 'privacy' | 'calculator';
export type OnboardingStep = InfoStep | PermissionId;

const INFO_STEPS: readonly OnboardingStep[] = ['intro', 'tiers', 'privacy', 'calculator'];

export function isInfoStep(step: OnboardingStep): step is InfoStep {
  return INFO_STEPS.includes(step);
}

const ORDER: readonly OnboardingStep[] = [
  ...INFO_STEPS,
  'accessibility',
  'overlay',
  'usageAccess',
  'notifications',
];

/** Same steps on every first run, even if a permission is already on; notifications only where asked for. */
export function onboardingSteps(status: PermissionStatus): OnboardingStep[] {
  return ORDER.filter((step) => step !== 'notifications' || status.notificationsApplicable);
}

/** Where Skip goes: an info screen jumps to the first permission, a permission screen to the next. */
export function skipIndex(steps: readonly OnboardingStep[], index: number): number {
  if (!isInfoStep(steps[index])) return index + 1;
  const firstPermission = steps.findIndex((step) => !isInfoStep(step));
  return firstPermission === -1 ? steps.length : firstPermission;
}

export function backIndex(index: number): number {
  return Math.max(0, index - 1);
}

/** One Tier row of the Tiers screen: name in the language shown, mood face and colors. */
export function tiersViewModel(locale: Locale = DEFAULT_LOCALE) {
  return TIER_CATALOG.map((tier, index) => ({
    name: tierLabel(index, locale),
    avatar: tier.avatar,
    color: tier.color,
    textColor: tier.textColor,
  }));
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
  /** Extra guidance above the buttons (Android 13+ restricted settings), or null. */
  hint: string | null;
}

const INFO_TEXT: Record<InfoStep, { title: MessageId; body: MessageId }> = {
  intro: { title: 'onboarding.welcomeTitle', body: 'onboarding.welcomeBody' },
  tiers: { title: 'onboarding.tiersTitle', body: 'onboarding.tiersBody' },
  privacy: { title: 'onboarding.privacyTitle', body: 'onboarding.privacyBody' },
  calculator: { title: 'onboarding.calc.title', body: 'onboarding.calc.body' },
};

export function onboardingStepViewModel(
  step: OnboardingStep,
  status: PermissionStatus,
  locale: Locale = DEFAULT_LOCALE,
): OnboardingStepViewModel {
  if (isInfoStep(step)) {
    return {
      step,
      title: t(locale, INFO_TEXT[step].title),
      body: t(locale, INFO_TEXT[step].body),
      badge: null,
      granted: false,
      primaryAction: 'next',
      primaryLabel: t(locale, step === 'intro' ? 'onboarding.getStarted' : 'onboarding.continue'),
      skipLabel: t(locale, 'onboarding.skip'),
      footnote: null,
      hint: null,
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
    // Android 13+ greys the switch out for apps installed outside the store; only useful until it is on.
    hint: step === 'accessibility' && !granted ? t(locale, 'onboarding.restrictedHint') : null,
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
