import type { EngineState } from '../engine';
import { emptyDayRecord } from '../storage';
import type { DayRecord } from '../storage';
import { pillViewModelFor } from '../overlay/pillViewModel';
import {
  historyViewModelFor,
  recordsWithLiveDay,
  shiftDay,
  weekChartFor,
} from './historyViewModel';

const MIN = 60_000;

/** A Day record from `[videos, minutes]` per Platform. */
function record(
  day: string,
  platforms: Partial<
    Record<'instagram' | 'youtube' | 'tiktok', [number, number]>
  > = {},
  incomplete: string[] = [],
): DayRecord {
  const r = emptyDayRecord(day);
  for (const key of ['instagram', 'youtube', 'tiktok'] as const) {
    const [videos, minutes] = platforms[key] ?? [0, 0];
    r.platforms[key] = {
      watchedVideos: videos,
      watchTimeMs: minutes * MIN,
      incomplete: incomplete.includes(key),
    };
  }
  return r;
}

function engineState(
  day: string,
  platforms: Partial<
    Record<'instagram' | 'youtube' | 'tiktok', [number, number]>
  >,
  unhealthy: string[] = [],
): EngineState {
  const make = (key: 'instagram' | 'youtube' | 'tiktok') => ({
    watchedVideos: platforms[key]?.[0] ?? 0,
    watchTimeMs: (platforms[key]?.[1] ?? 0) * MIN,
    detectionHealthy: !unhealthy.includes(key),
  });
  const p = {
    instagram: make('instagram'),
    youtube: make('youtube'),
    tiktok: make('tiktok'),
  };
  return {
    day,
    platforms: p,
    totals: {
      watchedVideos:
        p.instagram.watchedVideos +
        p.youtube.watchedVideos +
        p.tiktok.watchedVideos,
      watchTimeMs:
        p.instagram.watchTimeMs + p.youtube.watchTimeMs + p.tiktok.watchTimeMs,
    },
    tier: 0,
  };
}

// 2026-10-15 is a Thursday.
const TODAY = '2026-10-15';

describe('shiftDay', () => {
  it('moves a Day label across month and year ends', () => {
    expect(shiftDay('2026-10-15', -1)).toBe('2026-10-14');
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('History rows', () => {
  it('is empty, with guidance, when no Day has anything counted', () => {
    const vm = historyViewModelFor([], { today: TODAY });
    expect(vm.isEmpty).toBe(true);
    expect(vm.emptyTitle).toBe('No data yet');
    expect(vm.emptyMessage.length).toBeGreaterThan(0);
    expect(vm.rows).toEqual([]);
  });

  it('ignores a stored Day with nothing counted in it', () => {
    const vm = historyViewModelFor([record(TODAY)], { today: TODAY });
    expect(vm.isEmpty).toBe(true);
  });

  it('lists each Day with its count, time, and Tier, newest first', () => {
    const vm = historyViewModelFor(
      [
        record('2026-10-13', { tiktok: [5, 8] }),
        record('2026-10-14', { instagram: [20, 20], tiktok: [30, 18] }),
      ],
      { today: TODAY },
    );
    expect(vm.isEmpty).toBe(false);
    expect(vm.rows.map(r => r.day)).toEqual(['2026-10-14', '2026-10-13']);
    const [yesterday, earlier] = vm.rows;
    expect(yesterday.countText).toBe('50 videos');
    expect(yesterday.timeText).toBe('38:00');
    expect(yesterday.tier).toBe(2);
    expect(yesterday.tierLabel).toBe('Doomed');
    expect(yesterday.accentColor).toBe('#FB923C');
    expect(yesterday.avatar).toBe('mood_2_doomed');
    expect(earlier.tier).toBe(0);
    expect(earlier.tierLabel).toBe('Fresh');
  });

  it('takes the higher of the count Tier and the time Tier, like the engine', () => {
    const vm = historyViewModelFor(
      [record('2026-10-14', { youtube: [3, 130] })],
      {
        today: TODAY,
      },
    );
    expect(vm.rows[0].tier).toBe(4);
    expect(vm.rows[0].timeText).toBe('2:10:00');
  });

  it('uses the thresholds it is given', () => {
    const day = record('2026-10-14', { youtube: [12, 5] });
    const custom = {
      videos: [5, 10, 20, 40],
      minutes: [10, 30, 60, 120],
    } as const;
    expect(historyViewModelFor([day], { today: TODAY }).rows[0].tier).toBe(1);
    expect(
      historyViewModelFor([day], { today: TODAY, thresholds: custom }).rows[0]
        .tier,
    ).toBe(2);
  });

  it('names the Day: Today, Yesterday, then weekday and date', () => {
    const vm = historyViewModelFor(
      [
        record(TODAY, { tiktok: [1, 1] }),
        record('2026-10-14', { tiktok: [1, 1] }),
        record('2026-10-12', { tiktok: [1, 1] }),
      ],
      { today: TODAY },
    );
    expect(vm.rows.map(r => r.title)).toEqual([
      'Today',
      'Yesterday',
      'Mon 12 Oct',
    ]);
  });

  it('uses the singular unit for a single video', () => {
    const vm = historyViewModelFor([record('2026-10-12', { tiktok: [1, 1] })], {
      today: TODAY,
    });
    expect(vm.rows[0].countText).toBe('1 video');
  });

  it('marks a Day incomplete when detection failed for any Platform, and only then', () => {
    const vm = historyViewModelFor(
      [
        record('2026-10-14', { tiktok: [4, 10] }, ['tiktok']),
        record('2026-10-13', { tiktok: [4, 10] }),
      ],
      { today: TODAY },
    );
    const [incomplete, complete] = vm.rows;
    expect(incomplete.incomplete).toBe(true);
    expect(incomplete.incompleteNote).toBe(
      'Incomplete: detection stopped, the count may be low.',
    );
    expect(complete.incomplete).toBe(false);
    expect(complete.incompleteNote).toBeNull();
  });

  it('reads one label per row for screen readers, including the incomplete flag', () => {
    const vm = historyViewModelFor(
      [
        record('2026-10-14', { tiktok: [47, 38] }, ['tiktok']),
        record('2026-10-13', { tiktok: [47, 38] }),
      ],
      { today: TODAY },
    );
    expect(vm.rows[1].accessibilityLabel).toBe(
      'Tuesday 13 October. 47 videos, 38 minutes 0 seconds. Level 3 of 5, Doomed.',
    );
    expect(vm.rows[0].accessibilityLabel).toBe(
      'Wednesday 14 October. 47 videos, 38 minutes 0 seconds. Level 3 of 5, Doomed. ' +
        'Incomplete: detection stopped, the count may be low.',
    );
  });

  it('has the same Tier names as the Overlay pill', () => {
    for (let tier = 0; tier <= 4; tier += 1) {
      const pill = pillViewModelFor({
        ...engineState(TODAY, {}),
        tier: tier as 0 | 1 | 2 | 3 | 4,
      });
      // Build a Day that lands exactly on this Tier through its video count.
      const videos = [1, 10, 30, 60, 120][tier];
      const row = historyViewModelFor(
        [record('2026-10-14', { tiktok: [videos, 0] })],
        {
          today: TODAY,
        },
      ).rows[0];
      expect(row.tier).toBe(tier);
      expect(row.tierLabel).toBe(pill.labelText);
      expect(row.avatar).toBe(pill.avatar);
      expect(row.accentColor).toBe(pill.accentColor);
    }
  });

  it('stays correct for a long history', () => {
    const records: DayRecord[] = [];
    let day = TODAY;
    for (let i = 0; i < 1000; i += 1) {
      records.push(record(day, { tiktok: [i + 1, i] }));
      day = shiftDay(day, -1);
    }
    const vm = historyViewModelFor(records, { today: TODAY });
    expect(vm.rows).toHaveLength(1000);
    expect(vm.rows[0].day).toBe(TODAY);
    expect(vm.rows[999].day).toBe(shiftDay(TODAY, -999));
  });
});

describe('Live Day', () => {
  it('replaces the stored copy of the current Day with the live engine counts', () => {
    const stored = [
      record(TODAY, { tiktok: [10, 10] }),
      record('2026-10-14', { tiktok: [3, 3] }),
    ];
    const merged = recordsWithLiveDay(
      stored,
      engineState(TODAY, { tiktok: [14, 12] }),
    );
    expect(merged.map(r => r.day)).toEqual([TODAY, '2026-10-14']);
    expect(merged[0].platforms.tiktok.watchedVideos).toBe(14);
  });

  it('adds the current Day when it is not stored yet', () => {
    const merged = recordsWithLiveDay(
      [record('2026-10-14', { tiktok: [3, 3] })],
      engineState(TODAY, { tiktok: [2, 1] }),
    );
    expect(merged.map(r => r.day)).toEqual([TODAY, '2026-10-14']);
  });

  it('keeps the stored incomplete flag and adds any live detection failure', () => {
    const stored = [record(TODAY, { tiktok: [10, 10] }, ['tiktok'])];
    const merged = recordsWithLiveDay(
      stored,
      engineState(TODAY, { tiktok: [14, 12], youtube: [1, 1] }, ['youtube']),
    );
    expect(merged[0].platforms.tiktok.incomplete).toBe(true);
    expect(merged[0].platforms.youtube.incomplete).toBe(true);
    expect(merged[0].platforms.instagram.incomplete).toBe(false);
  });

  it('does not touch the input list', () => {
    const stored = [record(TODAY, { tiktok: [10, 10] })];
    recordsWithLiveDay(stored, engineState(TODAY, { tiktok: [14, 12] }));
    expect(stored[0].platforms.tiktok.watchedVideos).toBe(10);
  });
});

describe('7-day chart', () => {
  it('is empty, never a blank chart, when none of the 7 Days has data', () => {
    const chart = weekChartFor([], { today: TODAY });
    expect(chart.isEmpty).toBe(true);
    expect(chart.emptyTitle).toBe('No data yet');
    expect(chart.emptyMessage.length).toBeGreaterThan(0);
  });

  it('is empty when the only data is older than 7 Days', () => {
    const chart = weekChartFor([record('2026-10-08', { tiktok: [9, 9] })], {
      today: TODAY,
    });
    expect(chart.isEmpty).toBe(true);
  });

  it('has 7 bars, oldest first, ending on today, with a gap Day shown as zero', () => {
    const chart = weekChartFor(
      [
        record(TODAY, { tiktok: [40, 30] }),
        record('2026-10-13', { tiktok: [20, 10] }),
      ],
      { today: TODAY },
    );
    expect(chart.isEmpty).toBe(false);
    expect(chart.bars.map(b => b.day)).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
    expect(chart.bars.map(b => b.weekday)).toEqual([
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
    ]);
    expect(chart.bars.map(b => b.valueText)).toEqual([
      '0',
      '0',
      '0',
      '0',
      '20',
      '0',
      '40',
    ]);
    expect(chart.bars[6].isToday).toBe(true);
    expect(chart.bars[0].isToday).toBe(false);
  });

  it('scales bar heights against the biggest Day', () => {
    const chart = weekChartFor(
      [
        record(TODAY, { tiktok: [40, 1] }),
        record('2026-10-14', { tiktok: [20, 1] }),
        record('2026-10-13', { tiktok: [10, 1] }),
      ],
      { today: TODAY },
    );
    const heights = chart.bars.map(b => b.heightFraction);
    expect(heights.slice(-3)).toEqual([0.25, 0.5, 1]);
    expect(heights[0]).toBe(0);
  });

  it('colours each bar by the Tier of its Day', () => {
    const chart = weekChartFor(
      [
        record(TODAY, { tiktok: [65, 1] }),
        record('2026-10-14', { tiktok: [2, 1] }),
      ],
      { today: TODAY },
    );
    expect(chart.bars[6].tier).toBe(3);
    expect(chart.bars[6].color).toBe('#F87171');
    expect(chart.bars[5].tier).toBe(0);
  });

  it('describes the whole chart in one text summary for screen readers', () => {
    const chart = weekChartFor(
      [
        record(TODAY, { tiktok: [40, 30] }),
        record('2026-10-13', { instagram: [20, 10] }, ['instagram']),
      ],
      { today: TODAY },
    );
    expect(chart.summary).toBe(
      'Last 7 days. 60 videos, 40 minutes 0 seconds in total. ' +
        'Busiest day: Thursday 15 October, 40 videos. ' +
        'Friday 9 October: nothing counted. ' +
        'Saturday 10 October: nothing counted. ' +
        'Sunday 11 October: nothing counted. ' +
        'Monday 12 October: nothing counted. ' +
        'Tuesday 13 October: 20 videos, 10 minutes 0 seconds, Level 2 of 5, Drifting. ' +
        'Incomplete: detection stopped, the count may be low. ' +
        'Wednesday 14 October: nothing counted. ' +
        'Thursday 15 October: 40 videos, 30 minutes 0 seconds, Level 3 of 5, Doomed.',
    );
  });

  it('uses the singular unit in the summary', () => {
    const chart = weekChartFor([record(TODAY, { tiktok: [1, 1] })], {
      today: TODAY,
    });
    expect(chart.summary).toContain('1 video, 1 minute 0 seconds in total.');
  });

  it('labels every bar with its value, never colour alone', () => {
    const chart = weekChartFor([record(TODAY, { tiktok: [47, 38] })], {
      today: TODAY,
    });
    expect(chart.bars[6].valueText).toBe('47');
    expect(chart.bars[6].tierLabel).toBe('Doomed');
  });
});
