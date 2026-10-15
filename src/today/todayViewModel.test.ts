import type { EngineState } from '../engine';
import { todayViewModelFor } from './todayViewModel';

function state(
  platforms: Partial<Record<'instagram' | 'youtube' | 'tiktok', [number, number]>>,
  tier: EngineState['tier'] = 0,
  unhealthy: string[] = [],
): EngineState {
  const make = (key: 'instagram' | 'youtube' | 'tiktok') => ({
    watchedVideos: platforms[key]?.[0] ?? 0,
    watchTimeMs: platforms[key]?.[1] ?? 0,
    detectionHealthy: !unhealthy.includes(key),
  });
  const p = { instagram: make('instagram'), youtube: make('youtube'), tiktok: make('tiktok') };
  return {
    day: '2026-10-15',
    platforms: p,
    totals: {
      watchedVideos: p.instagram.watchedVideos + p.youtube.watchedVideos + p.tiktok.watchedVideos,
      watchTimeMs: p.instagram.watchTimeMs + p.youtube.watchTimeMs + p.tiktok.watchTimeMs,
    },
    tier,
  };
}

describe('Today view model', () => {
  it('is empty when nothing has been watched, with the guidance copy from the design system', () => {
    const vm = todayViewModelFor(state({}));
    expect(vm.isEmpty).toBe(true);
    expect(vm.emptyMessage).toBe(
      'Belum ada yang ditonton. Scroll seperti biasa, DoomMeter yang menghitung.',
    );
  });

  it('is not empty once there is Watch time even if no video reached 5 seconds', () => {
    expect(todayViewModelFor(state({ tiktok: [0, 3000] })).isEmpty).toBe(false);
  });

  it('shows the big count, the time, and the Tier badge', () => {
    const vm = todayViewModelFor(state({ tiktok: [47, 2_292_000] }, 2));
    expect(vm.countText).toBe('47');
    expect(vm.unitText).toBe('videos');
    expect(vm.timeText).toBe('38:12');
    expect(vm.tierLabel).toBe('Doomed');
    expect(vm.avatar).toBe('mood_2_doomed');
    expect(vm.accentColor).toBe('#FB923C');
  });

  it('uses the singular unit for one video and hours for long time', () => {
    const vm = todayViewModelFor(state({ youtube: [1, 3_725_000] }));
    expect(vm.unitText).toBe('video');
    expect(vm.timeText).toBe('1:02:05');
  });

  it('always lists the three Platforms with their display names, in a stable order', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }));
    expect(vm.rows.map((r) => r.label)).toEqual(['Reels', 'Shorts', 'TikTok']);
    expect(vm.rows.map((r) => r.platform)).toEqual(['instagram', 'youtube', 'tiktok']);
  });

  it('gives each Platform row its count, time, and share of Watch time', () => {
    const vm = todayViewModelFor(
      state({ instagram: [5, 100_000], youtube: [0, 0], tiktok: [10, 300_000] }),
    );
    const [reels, shorts, tiktok] = vm.rows;
    expect(reels.countText).toBe('5 videos');
    expect(reels.timeText).toBe('01:40');
    expect(reels.sharePercent).toBe(25);
    expect(reels.shareText).toBe('25%');
    expect(shorts.sharePercent).toBe(0);
    expect(tiktok.sharePercent).toBe(75);
    expect(tiktok.timeText).toBe('05:00');
  });

  it('has a zero share for every Platform when there is no Watch time', () => {
    const vm = todayViewModelFor(state({}));
    expect(vm.rows.every((r) => r.sharePercent === 0)).toBe(true);
  });

  it('flags a Platform whose detection stopped responding', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }, 0, ['tiktok']));
    expect(vm.rows[2].warning).toBe('Detection stopped responding. The count may be low.');
    expect(vm.rows[0].warning).toBeNull();
  });

  it('gives screen readers one summary and a label per row', () => {
    const vm = todayViewModelFor(state({ tiktok: [47, 2_292_000] }, 2));
    expect(vm.summaryLabel).toBe(
      'Today. 47 videos, 38 minutes 12 seconds. Level 3 of 5, Doomed.',
    );
    expect(vm.rows[2].accessibilityLabel).toBe('TikTok. 47 videos, 38 minutes 12 seconds, 100 percent.');
  });
});
