import { createCountingEngine } from './countingEngine';
import type { Clock, DaySummary } from './types';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

function setup(nowMs: number) {
  const now = nowMs;
  const clock: Clock = { now: () => now };
  const ended: DaySummary[] = [];
  const engine = createCountingEngine({ clock, onDayEnded: (s) => ended.push(s) });
  return { engine, ended };
}

const saved = {
  day: '2026-10-15',
  platforms: {
    instagram: { watchedVideos: 0, watchTimeMs: 0 },
    youtube: { watchedVideos: 2, watchTimeMs: 90_000 },
    tiktok: { watchedVideos: 10, watchTimeMs: 600_000 },
  },
};

describe('engine.restore', () => {
  it('brings back the counts of the current Day after a process restart', () => {
    const { engine } = setup(at(15, 12));
    engine.restore(saved);

    const state = engine.getState();
    expect(state.day).toBe('2026-10-15');
    expect(state.platforms.tiktok.watchedVideos).toBe(10);
    expect(state.totals).toEqual({ watchedVideos: 12, watchTimeMs: 690_000 });
  });

  it('keeps counting on top of the restored counts', () => {
    const { engine } = setup(at(15, 12));
    engine.restore(saved);
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: at(15, 12) });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: at(15, 12) + 6000 });

    const state = engine.getState();
    expect(state.platforms.tiktok.watchedVideos).toBe(11);
    expect(state.platforms.tiktok.watchTimeMs).toBe(606_000);
  });

  it('adds to counts gathered before the restore finished loading', () => {
    const { engine } = setup(at(15, 12));
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: at(15, 12) });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: at(15, 12) + 6000 });
    engine.restore(saved);

    const state = engine.getState();
    expect(state.platforms.tiktok.watchedVideos).toBe(11);
    expect(state.platforms.tiktok.watchTimeMs).toBe(606_000);
  });

  it('ignores a restored Day that is older than the engine current Day', () => {
    const { engine } = setup(at(16, 12));
    engine.handle({ type: 'screenOn', at: at(16, 12) });
    engine.restore(saved);

    expect(engine.getState().totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
  });

  it('reports a restored Day that has already ended once the clock is past it', () => {
    const { engine, ended } = setup(at(16, 12));
    engine.restore(saved);

    const state = engine.getState();
    expect(state.day).toBe('2026-10-16');
    expect(state.totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
    expect(ended).toHaveLength(1);
    expect(ended[0].day).toBe('2026-10-15');
    expect(ended[0].state.platforms.tiktok.watchedVideos).toBe(10);
  });

  it('ignores negative or non-finite numbers in a snapshot', () => {
    const { engine } = setup(at(15, 12));
    engine.restore({
      day: '2026-10-15',
      platforms: {
        instagram: { watchedVideos: -3, watchTimeMs: Number.NaN },
        youtube: { watchedVideos: 1.5, watchTimeMs: 1000 },
        tiktok: { watchedVideos: 1, watchTimeMs: Infinity },
      },
    });

    const { totals } = engine.getState();
    expect(totals.watchedVideos).toBe(1);
    expect(totals.watchTimeMs).toBe(1000);
  });
});
