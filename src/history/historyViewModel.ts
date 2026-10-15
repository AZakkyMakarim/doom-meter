import { DEFAULT_TIER_THRESHOLDS, PLATFORMS } from '../engine';
import type { EngineState, Tier, TierThresholds } from '../engine';
import { computeTier } from '../engine/tier';
import { colors } from '../design/tokens';
import { formatClock, plural, spokenDuration } from '../format/duration';
import type { DayRecord } from '../storage';

/**
 * Everything the History list and the 7-day chart draw, derived from stored Day
 * records (MASTER.md sections 6.4 and 6.5). The screens hold no counting or copy rules.
 */

export const EMPTY_TITLE = 'No data yet';
export const HISTORY_EMPTY_MESSAGE =
  'Days show up here once DoomMeter has counted some scrolling. Turn on the overlay and scroll as usual.';
export const CHART_EMPTY_MESSAGE =
  'The last 7 days will be charted here once DoomMeter has counted some scrolling.';
export const INCOMPLETE_NOTE =
  'Incomplete: detection stopped, the count may be low.';

const CHART_DAYS = 7;

/** Tier names and mood avatars (MASTER 2.1); the Overlay pill uses the same ones. */
const TIER_STYLES = [
  { label: 'Fresh', avatar: 'mood_0_fresh' },
  { label: 'Drifting', avatar: 'mood_1_drifting' },
  { label: 'Doomed', avatar: 'mood_2_doomed' },
  { label: 'Cooked', avatar: 'mood_3_cooked' },
  { label: 'Terminal', avatar: 'mood_4_terminal' },
] as const;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

function weekdayName(label: string): string {
  return WEEKDAYS[parseDay(label).getUTCDay()];
}

function shortDate(label: string): string {
  const d = parseDay(label);
  return `${weekdayName(label).slice(0, 3)} ${d.getUTCDate()} ${MONTHS[
    d.getUTCMonth()
  ].slice(0, 3)}`;
}

function spokenDate(label: string): string {
  const d = parseDay(label);
  return `${weekdayName(label)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
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

function tierSentence(tier: Tier): string {
  return `Level ${tier + 1} of 5, ${TIER_STYLES[tier].label}.`;
}

export interface ViewOptions {
  /** The current Day label (YYYY-MM-DD). */
  today: string;
  /** Tier thresholds; defaults to the engine defaults. */
  thresholds?: TierThresholds;
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

function titleFor(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return shortDate(day);
}

export function historyViewModelFor(
  records: DayRecord[],
  options: ViewOptions,
): HistoryViewModel {
  const thresholds = options.thresholds ?? DEFAULT_TIER_THRESHOLDS;
  const rows: DayRowViewModel[] = [];
  const newestFirst = [...records].sort((a, b) =>
    a.day < b.day ? 1 : a.day > b.day ? -1 : 0,
  );
  for (const record of newestFirst) {
    const figures = figuresFor(record, thresholds);
    if (!hasData(figures)) continue;
    const style = TIER_STYLES[figures.tier];
    const incompleteNote = figures.incomplete ? INCOMPLETE_NOTE : null;
    rows.push({
      day: record.day,
      title: titleFor(record.day, options.today),
      countText: plural(figures.videos, 'video'),
      timeText: formatClock(figures.watchTimeMs),
      tier: figures.tier,
      tierLabel: style.label,
      avatar: style.avatar,
      accentColor: colors.sev[figures.tier],
      incomplete: figures.incomplete,
      incompleteNote,
      accessibilityLabel:
        `${spokenDate(record.day)}. ${plural(figures.videos, 'video')}, ` +
        `${spokenDuration(figures.watchTimeMs)}. ${tierSentence(
          figures.tier,
        )}` +
        (incompleteNote === null ? '' : ` ${incompleteNote}`),
    });
  }
  return {
    isEmpty: rows.length === 0,
    emptyTitle: EMPTY_TITLE,
    emptyMessage: HISTORY_EMPTY_MESSAGE,
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
      weekday: weekdayName(day).slice(0, 3),
      valueText: `${f.videos}`,
      heightFraction: maxVideos > 0 ? f.videos / maxVideos : 0,
      tier: f.tier,
      tierLabel: TIER_STYLES[f.tier].label,
      color: colors.sev[f.tier],
      isToday: day === options.today,
    };
  });

  const isEmpty = !figures.some(hasData);

  const parts = [
    `Last 7 days. ${plural(totalVideos, 'video')}, ${spokenDuration(
      totalTimeMs,
    )} in total.`,
  ];
  if (maxVideos > 0) {
    // On a tie the most recent Day is named.
    let busiest = 0;
    figures.forEach((f, i) => {
      if (f.videos >= figures[busiest].videos) busiest = i;
    });
    parts.push(
      `Busiest day: ${spokenDate(days[busiest])}, ${plural(
        maxVideos,
        'video',
      )}.`,
    );
  }
  days.forEach((day, i) => {
    const f = figures[i];
    if (!hasData(f)) {
      parts.push(`${spokenDate(day)}: nothing counted.`);
      return;
    }
    parts.push(
      `${spokenDate(day)}: ${plural(f.videos, 'video')}, ${spokenDuration(
        f.watchTimeMs,
      )}, ` + `${tierSentence(f.tier)}`,
    );
    if (f.incomplete) parts.push(INCOMPLETE_NOTE);
  });

  return {
    isEmpty,
    emptyTitle: EMPTY_TITLE,
    emptyMessage: CHART_EMPTY_MESSAGE,
    bars,
    summary: parts.join(' '),
  };
}
