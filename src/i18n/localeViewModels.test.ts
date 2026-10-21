import { tierLabel } from './text';
import { createCountingEngine } from '../engine';
import type { EngineState } from '../engine';
import { formatClock, plural, spokenDuration } from '../format/duration';
import { historyViewModelFor, weekChartFor } from '../history/historyViewModel';
import { panelViewModelFor } from '../overlay/panelViewModel';
import { createPillPresenter, pillViewModelFor } from '../overlay/pillViewModel';
import { notCountingNotice, permissionBanner, permissionInfo } from '../permissions/permissionState';
import type { DayRecord } from '../storage';
import { todayViewModelFor } from '../today/todayViewModel';

/** An engine state built through the real engine: `videos` swipes and `ms` of Watch time on TikTok. */
function stateWith(videos: number, ms: number): EngineState {
  let now = 1_700_000_000_000;
  const engine = createCountingEngine({ clock: { now: () => now } });
  engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
  for (let i = 0; i < videos; i += 1) {
    now += 6000;
    engine.handle({ type: 'videoChanged', platform: 'tiktok' });
  }
  now += ms;
  engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
  return engine.getState();
}

const NONE = {
  accessibility: false,
  overlay: false,
  usageAccess: false,
  notifications: false,
  notificationsApplicable: true,
};

describe('duration text', () => {
  it('counts and speaks durations in the language', () => {
    expect(plural(1, 'video')).toBe('1 video');
    expect(plural(1, 'video', 'id')).toBe('1 video');
    expect(plural(2, 'video', 'id')).toBe('2 video');
    expect(plural(1, 'minute', 'id')).toBe('1 menit');
    expect(plural(2, 'minute', 'id')).toBe('2 menit');
    expect(spokenDuration(3_723_000, 'id')).toBe('1 jam 2 menit 3 detik');
    expect(spokenDuration(3_723_000)).toBe('1 hour 2 minutes 3 seconds');
    expect(formatClock(3_723_000)).toBe('1:02:03');
  });
});

describe('Overlay pill and panel by locale', () => {
  it('reads in English by default, exactly as before', () => {
    const pill = pillViewModelFor(stateWith(2, 61_000));
    expect(pill.unitText).toBe('videos');
    expect(pill.contentDescription).toBe(
      'Doom meter. 3 videos, 1 minute 13 seconds. Level 1 of 5, Vibing.',
    );
    expect(pill.collapsedLabel).toBe('Collapsed');
    expect(pill.panel.closeLabel).toBe('Close');
    expect(pill.panel.dayText).toBe('Today');
  });

  it('switches the pill and the panel to Indonesian when asked', () => {
    const pill = pillViewModelFor(stateWith(2, 61_000), { locale: 'id' });
    expect(pill.unitText).toBe('video');
    expect(pill.collapsedLabel).toBe('Tertutup');
    expect(pill.panel.closeLabel).toBe('Tutup');
    expect(pill.panel.dayText).toBe('Hari ini');
    expect(pill.panel.rows[2].unitText).toBe('video');
    expect(panelViewModelFor(stateWith(1, 0), 'id').closeLabel).toBe('Tutup');
  });

  it('keeps a presenter on the locale of the options it is given', () => {
    const present = createPillPresenter();
    const state = stateWith(1, 0);
    expect(present(state, { locale: 'id' }).collapsedLabel).toBe('Tertutup');
    expect(present(state, { locale: 'en' }).collapsedLabel).toBe('Collapsed');
  });
});

describe('Tier names in Indonesian', () => {
  it('names the Tier on the pill, the panel and Today', () => {
    const heavy = stateWith(40, 0);
    const pill = pillViewModelFor(heavy, { locale: 'id' });
    expect(pill.labelText).toBe(tierLabel(pill.tier, 'id'));
    expect(pill.contentDescription).toContain(`, ${pill.labelText}.`);
    expect(['Santuy', 'Oleng', 'Madesu', 'Cengoh', 'Wassalam']).toContain(pill.labelText);
    expect(pillViewModelFor(stateWith(0, 0), { locale: 'id' }).labelText).toBe('Santuy');
    expect(todayViewModelFor(heavy, { locale: 'id' }).summaryLabel).toContain(pill.labelText);
    expect(panelViewModelFor(heavy, 'id').tierName).toBe(pill.labelText);
  });

  it('names the Tiers in History and the 7-day chart', () => {
    const records: DayRecord[] = [
      {
        day: '2026-10-21',
        platforms: {
          instagram: { watchedVideos: 3, watchTimeMs: 1000, incomplete: false },
          youtube: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
          tiktok: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
          facebook: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        },
      },
    ];
    expect(historyViewModelFor(records, { today: '2026-10-21', locale: 'id' }).rows[0].tierLabel).toBe(
      'Santuy',
    );
    const chart = weekChartFor(records, { today: '2026-10-21', locale: 'id' });
    expect(chart.bars[6].tierLabel).toBe('Santuy');
    expect(chart.summary).toMatch(/^7 hari terakhir\. 3 video, 0 menit 1 detik total./);
    expect(chart.summary).toContain('Hari tersibuk: Rabu 21 Oktober, 3 video.');
    expect(chart.summary).toContain('Selasa 20 Oktober: tidak ada yang tercatat.');
    expect(chart.bars[6].weekday).toBe('Rab');
  });
});

describe('permission text by locale', () => {
  it('words the banner and the notice from the catalog', () => {
    expect(permissionBanner(NONE)?.message).toBe(
      'DoomMeter is not counting. Turn on Accessibility service and Display over other apps.',
    );
    expect(permissionBanner(NONE, 'id')?.fixes[0].label).toBe('Perbaiki izin');
    expect(notCountingNotice(NONE, 'en')?.title).toBe('Not counting yet');
    expect(permissionInfo('overlay', 'en').title).toBe('Display over other apps');
  });
});

describe('Today by locale', () => {
  it('reads in English by default and in Indonesian when asked', () => {
    const state = stateWith(2, 61_000);
    const english = todayViewModelFor(state);
    expect(english.unitText).toBe('videos');
    expect(english.rows[2].countText).toBe('3 videos');
    expect(english.summaryLabel).toMatch(/^Today\. 3 videos, /);
    const indonesian = todayViewModelFor(state, { locale: 'id' });
    expect(indonesian.rows[2].countText).toBe('3 video');
    expect(indonesian.summaryLabel).toBe('Hari ini. 3 video, 1 menit 13 detik. Tingkat 1 dari 5, Santuy.');
  });

  it('names the Platform in a detection warning', () => {
    const engine = createCountingEngine({ clock: { now: () => 0 } });
    engine.handle({ type: 'detectionFailed', platform: 'tiktok' });
    const [warning] = todayViewModelFor(engine.getState(), { usageAccess: true }).warnings;
    expect(warning.title).toBe('TikTok detection is not responding');
    expect(warning.accessibilityLabel).toBe(
      'Warning. TikTok detection is not responding. Watch time still counts through Usage Access. Videos are not counted until it is back.',
    );
  });
});

describe('History by locale', () => {
  const records: DayRecord[] = [
    {
      day: '2026-10-21',
      platforms: {
        instagram: { watchedVideos: 3, watchTimeMs: 61_000, incomplete: false },
        youtube: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        tiktok: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        facebook: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
      },
    },
    {
      day: '2026-10-12',
      platforms: {
        instagram: { watchedVideos: 1, watchTimeMs: 1000, incomplete: true },
        youtube: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        tiktok: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        facebook: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
      },
    },
  ];

  it('titles and speaks Days in English by default', () => {
    const vm = historyViewModelFor(records, { today: '2026-10-21' });
    expect(vm.rows.map((r) => r.title)).toEqual(['Today', 'Mon 12 Oct']);
    expect(vm.rows[1].accessibilityLabel).toMatch(/^Monday 12 October\. 1 video, /);
    expect(vm.emptyTitle).toBe('No data yet');
  });

  it('titles and counts Days in Indonesian when asked', () => {
    const vm = historyViewModelFor(records, { today: '2026-10-21', locale: 'id' });
    expect(vm.rows[0].title).toBe('Hari ini');
    expect(vm.rows[0].countText).toBe('3 video');
    expect(vm.rows[1].title).toBe('Sen 12 Okt');
    expect(vm.rows[1].tierLabel).toBe('Santuy');
    expect(vm.rows[1].accessibilityLabel).toMatch(/^Senin 12 Oktober\. 1 video, 0 menit 1 detik./);
    expect(vm.emptyTitle).toBe('Belum ada data');
  });

  it('describes the 7-day chart in the language', () => {
    const chart = weekChartFor(records, { today: '2026-10-21', locale: 'en' });
    expect(chart.summary).toMatch(/^Last 7 days\. 3 videos, 1 minute 1 second in total\./);
    expect(chart.summary).toContain('Busiest day: Wednesday 21 October, 3 videos.');
    expect(chart.summary).toContain('Tuesday 20 October: nothing counted.');
    expect(chart.bars[6].weekday).toBe('Wed');
  });
});
