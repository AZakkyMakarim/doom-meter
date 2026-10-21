import type { EngineState, Platform } from '../engine';
import { todayViewModelFor } from './todayViewModel';

function state(
  counts: Partial<Record<Platform, [number, number]>>,
  options: { failed?: Platform[]; incomplete?: Platform[] } = {},
): EngineState {
  const failed = options.failed ?? [];
  const incomplete = options.incomplete ?? failed;
  const make = (key: Platform) => ({
    watchedVideos: counts[key]?.[0] ?? 0,
    watchTimeMs: counts[key]?.[1] ?? 0,
    detectionHealthy: !failed.includes(key),
    incomplete: incomplete.includes(key),
  });
  const platforms = { instagram: make('instagram'), youtube: make('youtube'), tiktok: make('tiktok'), facebook: make('facebook') };
  return {
    day: '2026-10-15',
    platforms,
    totals: {
      watchedVideos: Object.values(platforms).reduce((sum, p) => sum + p.watchedVideos, 0),
      watchTimeMs: Object.values(platforms).reduce((sum, p) => sum + p.watchTimeMs, 0),
    },
    tier: 0,
  };
}

describe('Today view model: detection failure', () => {
  it('has no warning and no incomplete note while detection is healthy', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }));
    expect(vm.warnings).toEqual([]);
    expect(vm.incompleteNote).toBeNull();
  });

  it('names the Platform whose detection is not responding, and says Watch time still counts with Usage Access', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }, { failed: ['tiktok'] }), {
      usageAccess: true,
    });
    expect(vm.warnings).toEqual([
      {
        platform: 'tiktok',
        title: 'TikTok detection is not responding',
        message: 'Watch time still counts through Usage Access. Videos are not counted until it is back.',
        accessibilityLabel:
          'Warning. TikTok detection is not responding. Watch time still counts through Usage Access. ' +
          'Videos are not counted until it is back.',
      },
    ]);
  });

  it('says nothing is counted, and points at Usage Access, when it is not granted', () => {
    const vm = todayViewModelFor(state({}, { failed: ['youtube'] }), { usageAccess: false });
    expect(vm.warnings).toHaveLength(1);
    expect(vm.warnings[0].title).toBe('YouTube detection is not responding');
    expect(vm.warnings[0].message).toBe(
      'Nothing is counted until it is back. Usage Access would keep Watch time going.',
    );
  });

  it('assumes Usage Access is off when the caller does not know', () => {
    const vm = todayViewModelFor(state({}, { failed: ['instagram'] }));
    expect(vm.warnings[0].message).toContain('Nothing is counted');
  });

  it('warns once per failed Platform, in the usual order, using the Platform names', () => {
    const vm = todayViewModelFor(state({}, { failed: ['tiktok', 'instagram'] }));
    expect(vm.warnings.map((w) => w.title)).toEqual([
      'Instagram detection is not responding',
      'TikTok detection is not responding',
    ]);
  });

  it('marks the Day incomplete, and keeps doing so after detection recovered', () => {
    const recovered = todayViewModelFor(state({ tiktok: [3, 60_000] }, { incomplete: ['tiktok'] }));
    expect(recovered.warnings).toEqual([]);
    expect(recovered.incompleteNote).toBe('Incomplete: detection stopped, the count may be low.');
  });

  it('does not show the "nothing watched" empty state while the Day is incomplete', () => {
    expect(todayViewModelFor(state({}, { failed: ['tiktok'] })).isEmpty).toBe(false);
    expect(todayViewModelFor(state({})).isEmpty).toBe(true);
  });

  it('adds the incomplete note to the summary label for screen readers', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }, { failed: ['tiktok'] }));
    expect(vm.summaryLabel).toContain('Incomplete: detection stopped, the count may be low.');
  });

  it('flags the failed Platform row for screen readers too', () => {
    const vm = todayViewModelFor(state({ tiktok: [3, 60_000] }, { failed: ['tiktok'] }));
    expect(vm.rows[2].accessibilityLabel).toContain('Detection not responding.');
    expect(vm.rows[0].accessibilityLabel).not.toContain('Detection');
  });
});
