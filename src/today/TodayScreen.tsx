import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';
import { platformColors } from '../design/platformTokens';
import type { EngineState } from '../engine';
import type { NotCountingNotice } from '../permissions/permissionState';
import { WeekChartCard } from '../history/WeekChartCard';
import { todayViewModelFor } from './todayViewModel';
import type {
  DetectionWarningViewModel,
  PlatformRowViewModel,
  TodayViewModel,
} from './todayViewModel';

/** Mood avatars ship as Android drawables (the overlay uses the same ones). */
function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <Image
      source={{ uri: name }}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function PlatformRow({ row }: { row: PlatformRowViewModel }) {
  return (
    <View style={styles.platformRow} accessible accessibilityLabel={row.accessibilityLabel}>
      <View style={styles.platformHeader}>
        <View style={styles.platformName}>
          <View style={[styles.platformDot, { backgroundColor: platformColors[row.platform] }]} />
          <Text style={styles.platformLabel}>{row.label}</Text>
        </View>
        <Text style={styles.platformStats}>
          {row.countText} · {row.timeText}
        </Text>
      </View>
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${row.sharePercent}%`, backgroundColor: platformColors[row.platform] },
            ]}
          />
        </View>
        <Text style={styles.barLabel}>{row.shareText}</Text>
      </View>
      {row.warning !== null && <Text style={styles.warning}>{row.warning}</Text>}
    </View>
  );
}

/** Names the Platform whose detection is not responding. Text first, colour second. */
function DetectionWarning({ warning }: { warning: DetectionWarningViewModel }) {
  return (
    <View
      style={styles.warningCard}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={warning.accessibilityLabel}>
      <Text style={styles.warningKicker}>Warning</Text>
      <Text style={styles.warningTitle}>{warning.title}</Text>
      <Text style={styles.warningMessage}>{warning.message}</Text>
    </View>
  );
}

function Summary({ vm }: { vm: TodayViewModel }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={vm.summaryLabel}>
      <View style={styles.summaryTop}>
        <Avatar name={vm.avatar} size={96} />
        <View style={styles.summaryNumbers}>
          <Text style={styles.count}>{vm.countText}</Text>
          <Text style={styles.unit}>{vm.unitText}</Text>
        </View>
      </View>
      <View style={styles.summaryBottom}>
        <Text style={styles.time}>{vm.timeText}</Text>
        <View style={[styles.badge, { backgroundColor: vm.accentColor }]}>
          <Text style={styles.badgeText}>{vm.tierLabel}</Text>
        </View>
      </View>
      {vm.incompleteNote !== null && <Text style={styles.warning}>{vm.incompleteNote}</Text>}
    </View>
  );
}

function EmptyState({
  vm,
  onEnableOverlay,
  notice,
}: {
  vm: TodayViewModel;
  onEnableOverlay: (() => void) | null;
  notice: NotCountingNotice | null;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.emptyAvatar}>
        <Avatar name={vm.avatar} size={96} />
      </View>
      <Text style={styles.emptyTitle}>{notice?.title ?? 'No data yet'}</Text>
      <Text style={styles.body}>{notice?.message ?? vm.emptyMessage}</Text>
      {onEnableOverlay !== null && (
        <Pressable
          accessibilityRole="button"
          onPress={onEnableOverlay}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonLabel}>Enable overlay</Text>
        </Pressable>
      )}
    </View>
  );
}

export interface TodayScreenProps {
  state: EngineState;
  /** Whether the Overlay pill is switched on and permitted; the empty-state CTA hides when it is. */
  overlayActive: boolean;
  onEnableOverlay: () => void;
  /** Set while a required permission is off: the empty state says so instead of "nothing watched". */
  notCountingNotice?: NotCountingNotice | null;
  /** Whether Usage Access is granted, so a detection warning can say what still counts. */
  usageAccess?: boolean;
}

/** The home screen: today's count, Watch time, Tier badge, and per-Platform breakdown. */
export function TodayScreen({
  state,
  overlayActive,
  onEnableOverlay,
  notCountingNotice = null,
  usageAccess = false,
}: TodayScreenProps) {
  const vm = todayViewModelFor(state, { usageAccess });
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Today
      </Text>
      {vm.warnings.map((warning) => (
        <DetectionWarning key={warning.platform} warning={warning} />
      ))}
      {vm.isEmpty ? (
        <EmptyState
          vm={vm}
          onEnableOverlay={overlayActive || notCountingNotice !== null ? null : onEnableOverlay}
          notice={notCountingNotice}
        />
      ) : (
        <>
          <Summary vm={vm} />
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>By platform</Text>
            {vm.rows.map((row) => (
              <PlatformRow key={row.platform} row={row} />
            ))}
          </View>
        </>
      )}
      <WeekChartCard state={state} />
    </View>
  );
}

const MONO_BOLD = 'JetBrainsMono-Bold';
const MONO_MEDIUM = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  screen: {
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
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
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryNumbers: {
    flexShrink: 1,
  },
  count: {
    color: colors.text,
    fontFamily: MONO_BOLD,
    fontSize: 40,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  summaryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  time: {
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.onSev,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  platformRow: {
    gap: 8,
  },
  platformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  platformName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platformDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  platformLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  platformStats: {
    color: colors.textMuted,
    fontFamily: MONO_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.overlayBgAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barLabel: {
    width: 48,
    textAlign: 'right',
    color: colors.textMuted,
    fontFamily: MONO_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  warning: {
    color: colors.sev[1],
    fontSize: 13,
    lineHeight: 18,
  },
  warningCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.sev[1],
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  warningKicker: {
    color: colors.sev[1],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  warningTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  warningMessage: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyAvatar: {
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.action,
  },
  primaryButtonLabel: {
    color: colors.onAction,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
