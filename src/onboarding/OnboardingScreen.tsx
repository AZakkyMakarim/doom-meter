import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TIER_CATALOG } from '../design/catalog';
import { colors } from '../design/tokens';
import { useSafeAreaPadding } from '../design/useSafeAreaPadding';
import { useLocale } from '../i18n/LocaleContext';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translate';
import type { PermissionId, PermissionStatus } from '../permissions/permissionState';
import {
  backIndex,
  isInfoStep,
  onboardingStepViewModel,
  onboardingSteps,
  skipIndex,
  tiersViewModel,
} from './onboardingFlow';
import type { OnboardingStep } from './onboardingFlow';
import { DEFAULT_HOURS, lifeCalculatorViewModel, stepHours } from './lifeCalculator';

export interface OnboardingScreenProps {
  /** Live status; the granted state of the current step updates when the user returns from settings. */
  status: PermissionStatus | null;
  onOpenSettings: (permission: PermissionId) => void;
  /** Called after the last step, whether permissions were granted or skipped. */
  onFinish: () => void;
}

const UNKNOWN: PermissionStatus = {
  accessibility: false,
  overlay: false,
  usageAccess: false,
  notifications: false,
  notificationsApplicable: true,
};

const FACE_HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A small copy of the pill, drawn only to show what it looks like (decorative). */
function MockPill({ tier, count, locale }: { tier: number; count: number; locale: Locale }) {
  return (
    <View style={styles.mockPill} {...FACE_HIDDEN}>
      <Image source={{ uri: TIER_CATALOG[tier].avatar }} style={styles.mockFace} />
      <Text style={styles.mockCount}>{count}</Text>
      <Text style={[styles.mockTier, { color: colors.sevText[tier] }]}>
        {tiersViewModel(locale)[tier].name}
      </Text>
    </View>
  );
}

/** The picture above each screen's card. */
function Illustration({ step, locale }: { step: OnboardingStep; locale: Locale }) {
  if (step === 'intro') {
    return (
      <View style={styles.illustration}>
        <MockPill tier={0} count={3} locale={locale} />
        <MockPill tier={2} count={34} locale={locale} />
      </View>
    );
  }
  if (step === 'privacy') {
    return (
      <View style={styles.illustration}>
        <MockPill tier={1} count={12} locale={locale} />
      </View>
    );
  }
  if (step === 'tiers' || step === 'calculator') return null;
  return (
    <View style={styles.illustration}>
      <Image source={{ uri: TIER_CATALOG[0].avatar }} style={styles.avatarImage} {...FACE_HIDDEN} />
    </View>
  );
}

/** First run: how it works, the Tiers, privacy, a calculator for fun, then one screen per permission. */
export function OnboardingScreen({ status, onOpenSettings, onFinish }: OnboardingScreenProps) {
  const locale = useLocale();
  const screenPadding = useSafeAreaPadding({ top: 24, bottom: 48, horizontal: 16 });
  const current = status ?? UNKNOWN;
  const steps = onboardingSteps(current);
  const [index, setIndex] = useState(0);
  // The calculator inputs live here, so going back to the screen finds them as they were. Never stored.
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [ageText, setAgeText] = useState('');
  const step = steps[Math.min(index, steps.length - 1)];
  const vm = onboardingStepViewModel(step, current, locale);

  const goTo = (target: number) => {
    if (target >= steps.length) onFinish();
    else setIndex(target);
  };
  const next = () => goTo(index + 1);

  const onPrimary = () => {
    if (vm.primaryAction === 'open' && !isInfoStep(step)) onOpenSettings(step);
    else next();
  };

  const calc = lifeCalculatorViewModel(hours, ageText, locale);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, screenPadding]}
      keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" />
      <View style={styles.topRow}>
        {index > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setIndex(backIndex(index))}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Text style={styles.backLabel}>{t(locale, 'onboarding.back')}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.progress}>
          {t(locale, 'onboarding.step', { step: index + 1, total: steps.length })}
        </Text>
      </View>
      <Illustration step={step} locale={locale} />
      <View style={styles.card}>
        {vm.badge !== null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{vm.badge}</Text>
          </View>
        )}
        <Text accessibilityRole="header" style={styles.title}>
          {vm.title}
        </Text>
        <Text style={styles.body}>{vm.body}</Text>
        {step === 'tiers' &&
          tiersViewModel(locale).map((tier, i) => (
            <View key={tier.name} style={styles.tierRow}>
              <Image source={{ uri: tier.avatar }} style={styles.tierFace} {...FACE_HIDDEN} />
              <Text style={[styles.tierName, { color: colors.sevText[i] }]}>{tier.name}</Text>
            </View>
          ))}
        {step === 'calculator' && (
          <View style={styles.calc}>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(locale, 'onboarding.calc.less')}
                accessibilityState={{ disabled: !calc.canLess }}
                disabled={!calc.canLess}
                onPress={() => setHours(stepHours(hours, -1))}
                style={({ pressed }) => [
                  styles.stepButton,
                  !calc.canLess && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.stepGlyph} {...FACE_HIDDEN}>
                  {'−'}
                </Text>
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={styles.hours}>
                {calc.hoursLabel}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(locale, 'onboarding.calc.more')}
                accessibilityState={{ disabled: !calc.canMore }}
                disabled={!calc.canMore}
                onPress={() => setHours(stepHours(hours, 1))}
                style={({ pressed }) => [
                  styles.stepButton,
                  !calc.canMore && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.stepGlyph} {...FACE_HIDDEN}>
                  +
                </Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{t(locale, 'onboarding.calc.ageLabel')}</Text>
            <TextInput
              accessibilityLabel={t(locale, 'onboarding.calc.ageLabel')}
              keyboardType="number-pad"
              value={ageText}
              onChangeText={setAgeText}
              maxLength={3}
              style={styles.input}
            />
            <View accessibilityLiveRegion="polite" style={styles.result}>
              {calc.resultValue !== null && (
                <>
                  <Text style={styles.resultLabel}>{t(locale, 'onboarding.calc.resultLabel')}</Text>
                  <Text style={styles.resultValue}>{calc.resultValue}</Text>
                </>
              )}
              <Text style={styles.resultNote}>{calc.resultMessage}</Text>
            </View>
          </View>
        )}
        {vm.badge !== null && (
          <Text style={styles.status}>{t(locale, vm.granted ? 'onboarding.granted' : 'onboarding.notGrantedYet')}</Text>
        )}
        {vm.hint !== null && <Text style={styles.hint}>{vm.hint}</Text>}
      </View>
      {vm.footnote !== null && <Text style={styles.footnote}>{vm.footnote}</Text>}
      <Pressable
        accessibilityRole="button"
        onPress={onPrimary}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryLabel}>{vm.primaryLabel}</Text>
      </Pressable>
      {vm.skipLabel !== null && (
        <Pressable
          accessibilityRole="button"
          onPress={() => goTo(skipIndex(steps, index))}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryLabel}>{vm.skipLabel}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const MONO_MEDIUM = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  container: {
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  back: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  backLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  progress: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  illustration: {
    alignItems: 'center',
    gap: 8,
  },
  avatarImage: {
    width: 96,
    height: 96,
  },
  mockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.overlayBg,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  mockFace: {
    width: 32,
    height: 32,
  },
  mockCount: {
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  mockTier: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierFace: {
    width: 40,
    height: 40,
  },
  tierName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  calc: {
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  stepGlyph: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  },
  hours: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.appBg,
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 16,
    paddingHorizontal: 12,
    fontVariant: ['tabular-nums'],
  },
  result: {
    gap: 4,
  },
  resultLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  resultValue: {
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 40,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  resultNote: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  status: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.action,
  },
  primaryLabel: {
    color: colors.onAction,
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
