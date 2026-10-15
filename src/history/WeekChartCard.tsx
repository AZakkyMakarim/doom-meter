import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';
import type { EngineState } from '../engine';
import { recordsWithLiveDay, weekChartFor } from './historyViewModel';
import type { WeekBarViewModel } from './historyViewModel';
import { useStoredDays } from './useStoredDays';

const PLOT_HEIGHT = 120;
const MIN_BAR_HEIGHT = 4;

function Bar({ bar }: { bar: WeekBarViewModel }) {
  const height = Math.max(
    MIN_BAR_HEIGHT,
    Math.round(bar.heightFraction * PLOT_HEIGHT),
  );
  return (
    <View style={styles.column}>
      <Text style={styles.value}>{bar.valueText}</Text>
      <View style={styles.plot}>
        <View style={[styles.bar, { height, backgroundColor: bar.color }]} />
      </View>
      <Text style={[styles.weekday, bar.isToday && styles.weekdayToday]}>
        {bar.weekday}
      </Text>
    </View>
  );
}

/** The 7-day bar chart on Today: one labelled bar per Day, one text summary for screen readers. */
export function WeekChartCard({ state }: { state: EngineState }) {
  // The last 7 stored Days always cover the window; today's bar is the live count.
  const stored = useStoredDays(7, state.day);
  const chart = useMemo(
    () =>
      weekChartFor(recordsWithLiveDay(stored.records, state), {
        today: state.day,
      }),
    [stored.records, state],
  );

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Last 7 days
      </Text>
      {chart.isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{chart.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{chart.emptyMessage}</Text>
        </View>
      ) : (
        <View
          style={styles.chart}
          accessible
          accessibilityLabel={chart.summary}
        >
          {chart.bars.map(bar => (
            <Bar key={bar.day} bar={bar} />
          ))}
        </View>
      )}
    </View>
  );
}

const MONO_MEDIUM = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  plot: {
    height: PLOT_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  weekday: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  weekdayToday: {
    color: colors.text,
    fontWeight: '600',
  },
  empty: {
    gap: 4,
    alignItems: 'center',
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
