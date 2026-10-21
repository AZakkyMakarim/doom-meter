import { PLATFORMS, TIER_CATALOG } from '../design/catalog';
import { DEFAULT_TIER_THRESHOLDS } from '../engine';
import type { EngineState, Tier, TierThresholds } from '../engine';
import { computeTier } from '../engine/tier';
import { formatClock, plural, spokenDuration } from '../format/duration';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { tierLabel, tierSentence } from '../i18n/text';
import { formatNumber, t } from '../i18n/translate';
import type { MessageId } from '../i18n/messages.en';
import type { DayRecord } from '../storage';

/**
 * Everything the History list and the 7-day chart draw, derived from stored Day
 * records (MASTER.md sections 6.4 and 6.5). The screens hold no counting or copy rules.
 */

const CHART_DAYS = 7;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDay(label: string): Date {
  const [y, m, d] = label.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The Day label `delta` calendar days from `label`. Pure date maths, so DST never shifts it. */
export function shiftDay(label: string, delta: number): string {
  const d = parseDay(label);
  d.setUTCDate(d.getUTCDate() + delta);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )}`;
}

function weekdayName(label: string, locale: Locale): string {
  return t(locale, `weekday.${parseDay(label).getUTCDay()}` as MessageId);
}

function monthName(label: string, locale: Locale): string {
  return t(locale, `month.${parseDay(label).getUTCMonth()}` as MessageId);
}

function shortDate(label: string, locale: Locale): string {
  const d = parseDay(label);
  return `${weekdayName(label, locale).slice(0, 3)} ${formatNumber(locale, d.getUTCDate())} ${monthName(
    label,
    locale,
  ).slice(0, 3)}`;
}

function spokenDate(label: string, locale: Locale): string {
  const d = parseDay(label);
  return `${weekdayName(label, locale)} ${formatNumber(locale, d.getUTCDate())} ${monthName(label, locale)}`;
}

interface DayFigures {
  videos: number;
  watchTimeMs: number;
  tier: Tier;
  incomplete: boolean;
}

function figuresFor(record: DayRecord, thresholds: TierThresholds): DayFigures {
  let videos = 0;
  let watchTimeMs = 0;
  let incomplete = false;
  for (const platform of PLATFORMS) {
    const p = record.platforms[platform];
    videos += p.watchedVideos;
    watchTimeMs += p.watchTimeMs;
    incomplete = incomplete || p.incomplete;
  }
  return {
    videos,
    watchTimeMs,
    tier: computeTier({ watchedVideos: videos, watchTimeMs }, thresholds),
    incomplete,
  };
}

function hasData(figures: DayFigures): boolean {
  return figures.videos > 0 || figures.watchTimeMs > 0;
}

export interface ViewOptions {
  /** The current Day label (YYYY-MM-DD). */
  today: string;
  /** Tier thresholds; defaults to the engine defaults. */
  thresholds?: TierThresholds;
  /** The language of every text. Default English. */
  locale?: Locale;
}

export interface DayRowViewModel {
  day: string;
  /** `Today`, `Yesterday`, or `Mon 12 Oct`. */
  title: string;
  countText: string;
  timeText: string;
  tier: Tier;
  tierLabel: string;
  /** Name of the mood avatar drawable (MASTER 2.1). */
  avatar: string;
  accentColor: string;
  incomplete: boolean;
  incompleteNote: string | null;
  accessibilityLabel: string;
}

export interface HistoryViewModel {
  isEmpty: boolean;
  emptyTitle: string;
  emptyMessage: string;
  /** Days with something counted, newest first. */
  rows: DayRowViewModel[];
}

function titleFor(day: string, today: string, locale: Locale): string {
  if (day === today) return t(locale, 'day.today');
  if (day === shiftDay(today, -1)) return t(locale, 'day.yesterday');
  return shortDate(day, locale);
}

export function historyViewModelFor(
  records: DayRecord[],
  options: ViewOptions,
): HistoryViewModel {
  const thresholds = options.thresholds ?? DEFAULT_TIER_THRESHOLDS;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const rows: DayRowViewModel[] = [];
  const newestFirst = [...records].sort((a, b) =>
    a.day < b.day ? 1 : a.day > b.day ? -1 : 0,
  );
  for (const record of newestFirst) {
    const figures = figuresFor(record, thresholds);
    if (!hasData(figures)) continue;
    const style = TIER_CATALOG[figures.tier];
    const incompleteNote = figures.incomplete ? t(locale, 'history.incomplete') : null;
    rows.push({
      day: record.day,
      title: titleFor(record.day, options.today, locale),
      countText: plural(figures.videos, 'video', locale),
      timeText: formatClock(figures.watchTimeMs),
      tier: figures.tier,
      tierLabel: tierLabel(figures.tier, locale),
      avatar: style.avatar,
      accentColor: style.textColor,
      incomplete: figures.incomplete,
      incompleteNote,
      accessibilityLabel: t(locale, 'history.rowLabel', {
        date: spokenDate(record.day, locale),
        videos: plural(figures.videos, 'video', locale),
        time: spokenDuration(figures.watchTimeMs, locale),
        tier: tierSentence(figures.tier, locale),
      }) + (incompleteNote === null ? '' : ` ${incompleteNote}`),
    });
  }
  return {
    isEmpty: rows.length === 0,
    emptyTitle: t(locale, 'history.emptyTitle'),
    emptyMessage: t(locale, 'history.emptyMessage'),
    rows,
  };
}

/**
 * The stored records with the current Day swapped for the live engine counts, so
 * History and the chart move with the pill instead of lagging the storage flush.
 * The stored incomplete flag stays set, and a live detection failure is added.
 */
export function recordsWithLiveDay(
  records: DayRecord[],
  state: EngineState,
): DayRecord[] {
  const stored = records.find(r => r.day === state.day);
  const live = {
    day: state.day,
    platforms: {} as DayRecord['platforms'],
  };
  for (const platform of PLATFORMS) {
    const p = state.platforms[platform];
    live.platforms[platform] = {
      watchedVideos: p.watchedVideos,
      watchTimeMs: p.watchTimeMs,
      incomplete:
        (stored?.platforms[platform].incomplete ?? false) ||
        p.incomplete ||
        !p.detectionHealthy,
    };
  }
  return [live, ...records.filter(r => r.day !== state.day)];
}

export interface WeekBarViewModel {
  day: string;
  /** `Mon`. */
  weekday: string;
  /** The bar's value label: the Day's Watched video count. */
  valueText: string;
  /** Bar height as a share of the biggest Day, 0-1. */
  heightFraction: number;
  tier: Tier;
  tierLabel: string;
  color: string;
  isToday: boolean;
}

export interface WeekChartViewModel {
  isEmpty: boolean;
  emptyTitle: string;
  emptyMessage: string;
  /** The last 7 Days, oldest first, ending on today. */
  bars: WeekBarViewModel[];
  /** One text description of the whole chart for screen readers (MASTER 6.4). */
  summary: string;
}

export function weekChartFor(
  records: DayRecord[],
  options: ViewOptions,
): WeekChartViewModel {
  const thresholds = options.thresholds ?? DEFAULT_TIER_THRESHOLDS;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const byDay = new Map<string, DayFigures>();
  for (const record of records)
    byDay.set(record.day, figuresFor(record, thresholds));

  const days: string[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i -= 1)
    days.push(shiftDay(options.today, -i));

  const none: DayFigures = {
    videos: 0,
    watchTimeMs: 0,
    tier: 0,
    incomplete: false,
  };
  const figures = days.map(day => byDay.get(day) ?? none);
  const maxVideos = Math.max(...figures.map(f => f.videos));
  const totalVideos = figures.reduce((sum, f) => sum + f.videos, 0);
  const totalTimeMs = figures.reduce((sum, f) => sum + f.watchTimeMs, 0);

  const bars = days.map((day, i): WeekBarViewModel => {
    const f = figures[i];
    return {
      day,
      weekday: weekdayName(day, locale).slice(0, 3),
      valueText: formatNumber(locale, f.videos),
      heightFraction: maxVideos > 0 ? f.videos / maxVideos : 0,
      tier: f.tier,
      tierLabel: tierLabel(f.tier, locale),
      color: TIER_CATALOG[f.tier].color,
      isToday: day === options.today,
    };
  });

  const isEmpty = !figures.some(hasData);

  const parts = [
    t(locale, 'chart.summary', {
      videos: plural(totalVideos, 'video', locale),
      time: spokenDuration(totalTimeMs, locale),
    }),
  ];
  if (maxVideos > 0) {
    // On a tie the most recent Day is named.
    let busiest = 0;
    figures.forEach((f, i) => {
      if (f.videos >= figures[busiest].videos) busiest = i;
    });
    parts.push(
      t(locale, 'chart.busiest', {
        date: spokenDate(days[busiest], locale),
        videos: plural(maxVideos, 'video', locale),
      }),
    );
  }
  days.forEach((day, i) => {
    const f = figures[i];
    const date = spokenDate(day, locale);
    if (!hasData(f)) {
      parts.push(t(locale, 'chart.nothing', { date }));
      return;
    }
    parts.push(
      t(locale, 'chart.day', {
        date,
        videos: plural(f.videos, 'video', locale),
        time: spokenDuration(f.watchTimeMs, locale),
        tier: tierSentence(f.tier, locale),
      }),
    );
    if (f.incomplete) parts.push(t(locale, 'history.incomplete'));
  });

  return {
    isEmpty,
    emptyTitle: t(locale, 'history.emptyTitle'),
    emptyMessage: t(locale, 'chart.empty'),
    bars,
    summary: parts.join(' '),
  };
}
