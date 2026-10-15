import { useState } from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';
import type { PermissionId, PermissionStatus } from '../permissions/permissionState';
import { onboardingStepViewModel, onboardingSteps } from './onboardingFlow';

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

/** First run: a welcome with the privacy statement, then one screen per permission. */
export function OnboardingScreen({ status, onOpenSettings, onFinish }: OnboardingScreenProps) {
  const current = status ?? UNKNOWN;
  const steps = onboardingSteps(current);
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];
  const vm = onboardingStepViewModel(step, current);

  const next = () => {
    if (index >= steps.length - 1) onFinish();
    else setIndex(index + 1);
  };

  const onPrimary = () => {
    if (vm.primaryAction === 'open' && step !== 'intro') onOpenSettings(step);
    else next();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.progress}>{`Step ${index + 1} of ${steps.length}`}</Text>
      {step === 'intro' && (
        <View style={styles.avatar}>
          <Image
            source={{ uri: 'mood_0_fresh' }}
            style={styles.avatarImage}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      )}
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
        {vm.badge !== null && (
          <Text style={styles.status}>{vm.granted ? 'Granted' : 'Not granted yet'}</Text>
        )}
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
          onPress={next}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryLabel}>{vm.skipLabel}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
    paddingBottom: 48,
    gap: 16,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  avatar: {
    alignItems: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
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
  status: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
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
    borderColor: colors.border,
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
});
