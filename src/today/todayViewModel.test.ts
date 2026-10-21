import type { EngineState } from '../engine';
import { showsEnableOverlayAction, todayViewModelFor } from './todayViewModel';

function state(
  platforms: Partial<Record<'instagram' | 'youtube' | 'tiktok' | 'facebook', [number, number]>>,
  tier: EngineState['tier'] = 0,
  unhealthy: string[] = [],
): EngineState {
  const make = (key: 'instagram' | 'youtube' | 'tiktok' | 'facebook') => ({
    watchedVideos: platforms[key]?.[0] ?? 0,
    watchTimeMs: platforms[key]?.[1] ?? 0,
    detectionHealthy: !unhealthy.includes(key),
    incomplete: unhealthy.includes(key),
  });
  const p = { instagram: make('instagram'), youtube: make('youtube'), tiktok: make('tiktok'), facebook: make('facebook') };
  return {
    day: '2026-10-15',
    platforms: p,
    totals: {
      watchedVideos: p.instagram.watchedVideos + p.youtube.watchedVideos + p.tiktok.watchedVideos + p.facebook.watchedVideos,
      watchTimeMs: p.instagram.watchTimeMs + p.youtube.watchTimeMs + p.tiktok.watchTimeMs + p.facebook.watchTimeMs,
    },
    tier,
  };
}

describe('Today view model', () => {
  it('is empty when nothing has been watched, with the guidance copy', () => {
    const vm = todayViewModelFor(state({}));
    expect(vm.isEmpty).toBe(true);
    expect(vm.emptyMessage).toBe(
      'Nothing watched yet. Scroll as usual, DoomMeter keeps count.',
    );
  });

  it('is not empty once there is Watch time even if no video was counted', () => {
    expect(todayViewModelFor(state({ tiktok: [0, 3000] })).isEmpty).toBe(false);
  });

  it('shows the big count, the time, and the Tier badge', () => {
    const vm = todayViewModelFor(state({ tiktok: [47, 2_292_000] }, 2));
    expect(vm.countText).toBe('47');
    expect(vm.unitText).toBe('videos');
    expect(vm.timeText).toBe('38:12');
    expect(vm.tierLabel).toBe('Washed');
    expect(vm.avatar).toBe('mood_2_washed');
    expect(vm.accentColor).toBe('#F87171');
  });

  it('uses the singular unit for one video and hours for long time', () => {
    const vm = todayViewModelFor(state({ youtube: [1, 3_725_000] }));
    expect(vm.unitText).toBe('video');
    expect(vm.timeText).toBe('1:02:05');
  });

  it('always lists the four Platforms with their display names, in a stable order', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }));
    expect(vm.rows.map((r) => r.label)).toEqual(['Reels', 'Shorts', 'TikTok', 'Facebook']);
    expect(vm.rows.map((r) => r.platform)).toEqual(['instagram', 'youtube', 'tiktok', 'facebook']);
  });

  it('gives each Platform tile its count and time', () => {
    const vm = todayViewModelFor(state({ instagram: [5, 100_000], tiktok: [10, 300_000] }));
    const [reels, , tiktok] = vm.rows;
    expect(reels.countText).toBe('5');
    expect(reels.timeText).toBe('01:40');
    expect(tiktok.countText).toBe('10');
    expect(tiktok.timeText).toBe('05:00');
  });

  it('keeps all four tiles when nothing was watched, showing 0 and 00:00', () => {
    const vm = todayViewModelFor(state({}));
    expect(vm.rows).toHaveLength(4);
    expect(vm.rows.map((r) => [r.countText, r.timeText])).toEqual(Array(4).fill(['0', '00:00']));
  });

  it('counts Facebook in its own row and in the totals', () => {
    const vm = todayViewModelFor(state({ facebook: [3, 90_000] }));
    expect(vm.rows[3].platform).toBe('facebook');
    expect(vm.rows[3].countText).toBe('3');
    expect(vm.rows[3].timeText).toBe('01:30');
    expect(vm.isEmpty).toBe(false);
  });

  it('flags a Platform whose detection stopped responding', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }, 0, ['tiktok']));
    expect(vm.rows[2].warning).toBe('Detection not responding.');
    expect(vm.rows[0].warning).toBeNull();
  });

  it('gives screen readers one summary and a label per row', () => {
    const vm = todayViewModelFor(state({ tiktok: [47, 2_292_000] }, 2));
    expect(vm.summaryLabel).toBe(
      'Today. 47 videos, 38 minutes 12 seconds. Level 3 of 5, Washed.',
    );
    expect(vm.rows[2].accessibilityLabel).toBe('TikTok, 47 videos, 38 minutes 12 seconds');
  });

  it('reads each tile as one phrase led by the app name, with zero spoken too', () => {
    const vm = todayViewModelFor(state({ instagram: [12, 1_080_000] }));
    expect(vm.rows[0].accessibilityLabel).toBe('Instagram, 12 videos, 18 minutes 0 seconds');
    expect(vm.rows[1].accessibilityLabel).toBe('YouTube, 0 videos, 0 minutes 0 seconds');
  });

  it('appends the detection warning to the tile phrase', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }, 0, ['tiktok']));
    expect(vm.rows[2].accessibilityLabel).toBe(
      'TikTok, 3 videos, 1 minute 0 seconds Detection not responding.',
    );
  });
});

describe('Today Platform header layout (MASTER 8: no clipping at the largest font)', () => {
  const layout = (options: { fontScale?: number; width?: number }) =>
    todayViewModelFor(state({}), options).platformLayout;

  it('is one row of four tiles at the default font on a 360dp screen', () => {
    expect(layout({ fontScale: 1, width: 360 })).toBe('row');
  });

  it('is a 2x2 grid once system text is enlarged', () => {
    expect(layout({ fontScale: 1.15, width: 360 })).toBe('grid');
    expect(layout({ fontScale: 2, width: 411 })).toBe('grid');
  });

  it('is a 2x2 grid on a narrow screen even at the default font', () => {
    expect(layout({ fontScale: 1, width: 320 })).toBe('grid');
  });

  it('defaults to the row when the font scale and width are unknown', () => {
    expect(layout({})).toBe('row');
  });
});

describe('Today empty state: Enable overlay action (ADR 0006)', () => {
  it('shows guidance and no action on a fresh install, where the pill is on', () => {
    const vm = todayViewModelFor(state({}));
    expect(vm.isEmpty).toBe(true);
    expect(vm.emptyMessage).toBe('Nothing watched yet. Scroll as usual, DoomMeter keeps count.');
    expect(showsEnableOverlayAction({ overlayActive: true, notCountingNotice: null })).toBe(false);
  });

  it('offers the action once the pill is switched off', () => {
    expect(showsEnableOverlayAction({ overlayActive: false, notCountingNotice: null })).toBe(true);
  });

  it('never offers the action while a permission notice replaces the guidance', () => {
    const notice = { title: 'Not counting yet', message: 'Turn on Accessibility.' };
    expect(showsEnableOverlayAction({ overlayActive: false, notCountingNotice: notice })).toBe(
      false,
    );
  });
});
