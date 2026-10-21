import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../design/tokens';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n/translate';
import { platformColors } from '../design/platformTokens';
import type { EngineState } from '../engine';
import type { NotCountingNotice } from '../permissions/permissionState';
import { WeekChartCard } from '../history/WeekChartCard';
import { showsEnableOverlayAction, todayViewModelFor } from './todayViewModel';
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

/** One equal-width tile: marker beside the name, the big count, the small time. Always drawn, even at zero. */
function PlatformTile({ row, grid }: { row: PlatformRowViewModel; grid: boolean }) {
  return (
    <View
      style={[styles.tile, grid ? styles.tileGrid : styles.tileRow]}
      accessible
      accessibilityLabel={row.accessibilityLabel}>
      <View style={styles.tileName}>
        <View style={[styles.platformDot, { backgroundColor: platformColors[row.platform] }]} />
        <Text style={styles.tileLabel}>{row.label}</Text>
      </View>
      <Text style={styles.tileCount}>{row.countText}</Text>
      <Text style={styles.tileTime}>{row.timeText}</Text>
    </View>
  );
}

/** Names the Platform whose detection is not responding. Text first, colour second. */
function DetectionWarning({ warning }: { warning: DetectionWarningViewModel }) {
  const locale = useLocale();
  return (
    <View
      style={styles.warningCard}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={warning.accessibilityLabel}>
      <Text style={styles.warningKicker}>{t(locale, 'today.warningKicker')}</Text>
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
  const locale = useLocale();
  return (
    <View style={styles.card}>
      <View style={styles.emptyAvatar}>
        <Avatar name={vm.avatar} size={96} />
      </View>
      <Text style={styles.emptyTitle}>{notice?.title ?? t(locale, 'today.emptyTitle')}</Text>
      <Text style={styles.body}>{notice?.message ?? vm.emptyMessage}</Text>
      {onEnableOverlay !== null && (
        <Pressable
          accessibilityRole="button"
          onPress={onEnableOverlay}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonLabel}>{t(locale, 'today.enableOverlay')}</Text>
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
  const locale = useLocale();
  const { fontScale, width } = useWindowDimensions();
  const vm = todayViewModelFor(state, { usageAccess, locale, fontScale, width });
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {t(locale, 'today.title')}
      </Text>
      {vm.warnings.map((warning) => (
        <DetectionWarning key={warning.platform} warning={warning} />
      ))}
      {vm.isEmpty ? (
        <EmptyState
          vm={vm}
          onEnableOverlay={
            showsEnableOverlayAction({ overlayActive, notCountingNotice }) ? onEnableOverlay : null
          }
          notice={notCountingNotice}
        />
      ) : (
        <>
          <Summary vm={vm} />
        </>
      )}
      <View style={styles.tiles}>
        {vm.rows.map((row) => (
          <PlatformTile key={row.platform} row={row} grid={vm.platformLayout === 'grid'} />
        ))}
      </View>
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
    flexWrap: 'wrap',
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
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
    alignItems: 'center',
  },
  // minWidth 0 lets four tiles share the row equally instead of growing with their text.
  tileRow: {
    flex: 1,
    minWidth: 0,
  },
  tileGrid: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  tileName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tileLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  tileCount: {
    color: colors.text,
    fontFamily: MONO_BOLD,
    fontSize: 20,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  tileTime: {
    color: colors.textMuted,
    fontFamily: MONO_MEDIUM,
    fontSize: 12,
    lineHeight: 16,
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
