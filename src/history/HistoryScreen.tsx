import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../design/tokens';
import { useSafeAreaPadding } from '../design/useSafeAreaPadding';
import type { EngineState } from '../engine';
import { historyViewModelFor, recordsWithLiveDay } from './historyViewModel';
import type { DayRowViewModel } from './historyViewModel';
import { useSettings } from '../settings/useSettings';
import { useStoredDays } from './useStoredDays';

/** Days read from storage per page; the next page loads as the list nears its end. */
const PAGE_SIZE = 60;

const DayRow = memo(
  function DayRowView({ row }: { row: DayRowViewModel }) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={row.accessibilityLabel}
      >
        <View style={styles.rowMain}>
          <Image
            source={{ uri: row.avatar }}
            style={styles.avatar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowStats}>
              {row.countText} · {row.timeText}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: row.accentColor }]}>
            <Text style={styles.badgeText}>{row.tierLabel}</Text>
          </View>
        </View>
        {row.incompleteNote !== null && (
          <Text style={styles.warning}>{row.incompleteNote}</Text>
        )}
      </View>
    );
  },
  // The accessibility label carries every displayed value, so it alone decides a redraw.
  (a, b) =>
    a.row.day === b.row.day &&
    a.row.title === b.row.title &&
    a.row.accessibilityLabel === b.row.accessibilityLabel,
);

function renderRow({ item }: { item: DayRowViewModel }) {
  return <DayRow row={item} />;
}

function keyForRow(row: DayRowViewModel) {
  return row.day;
}

/** History: one row per Day with its count, time, and Tier. Virtualized for long histories. */
export function HistoryScreen({ state }: { state: EngineState }) {
  // The bottom bar under this list owns the gesture-bar space (MASTER 8).
  const screenPadding = useSafeAreaPadding({ top: 24, bottom: 24, horizontal: 16 }, false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const stored = useStoredDays(limit, state.day);
  const { thresholds } = useSettings();
  const vm = useMemo(
    () =>
      historyViewModelFor(recordsWithLiveDay(stored.records, state), {
        today: state.day,
        thresholds,
      }),
    [stored.records, state, thresholds],
  );

  const loadMore = useCallback(() => {
    if (stored.loaded && !stored.exhausted)
      setLimit(current => current + PAGE_SIZE);
  }, [stored.loaded, stored.exhausted]);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, screenPadding]}
      data={vm.rows}
      renderItem={renderRow}
      keyExtractor={keyForRow}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews
      onEndReached={loadMore}
      onEndReachedThreshold={1.5}
      ListHeaderComponent={
        <Text accessibilityRole="header" style={styles.title}>
          History
        </Text>
      }
      ListEmptyComponent={
        stored.loaded ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>{vm.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{vm.emptyMessage}</Text>
          </View>
        ) : undefined
      }
    />
  );
}

const MONO_MEDIUM = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 32,
    height: 32,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  rowStats: {
    color: colors.textMuted,
    fontFamily: MONO_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
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
  warning: {
    color: colors.sev[1],
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
