import { createCountingEngine } from './countingEngine';
import type { Clock, CountingEngine, CountingEngineOptions, DaySummary } from './types';

/** Local-time timestamp; the engine works in local time, so tests do too. */
function local(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

type Config = Omit<CountingEngineOptions, 'clock' | 'onDayEnded'>;

function setup(config: Config = {}, startAt = local(2026, 1, 10, 12)) {
  let now = startAt;
  const clock: Clock = { now: () => now };
  const ended: DaySummary[] = [];
  const engine = createCountingEngine({
    clock,
    onDayEnded: (summary) => ended.push(summary),
    ...config,
  });
  return {
    engine,
    ended,
    advanceTo(t: number) {
      now = t;
    },
  };
}

/** Watches exactly `n` videos of 5s each on TikTok, starting at `start`. */
function watchVideos(engine: CountingEngine, n: number, start: number) {
  engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: start });
  for (let i = 1; i <= n; i++) {
    engine.handle({ type: 'videoChanged', platform: 'tiktok', at: start + i * 5000 });
  }
  engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: start + n * 5000 });
}

/** One long video of `ms` milliseconds (count 1, Watch time `ms`). */
function watchFor(engine: CountingEngine, ms: number, start: number) {
  engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: start });
  engine.handle({ type: 'surfaceFocusLost', platform: 'youtube', at: start + ms });
}

const MIN = 60_000;
const T0 = local(2026, 1, 10, 12);

describe('Tier from Watched video count', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [29, 1],
    [30, 2],
    [59, 2],
    [60, 3],
    [119, 3],
    [120, 4],
  ])('%i videos is Tier %i', (count, tier) => {
    const { engine } = setup();
    watchVideos(engine, count, T0);
    const state = engine.getState();
    expect(state.totals.watchedVideos).toBe(count);
    expect(state.tier).toBe(tier);
  });
});

describe('Tier from Watch time', () => {
  it.each([
    [9 * MIN, 0],
    [10 * MIN - 1, 0],
    [10 * MIN, 1],
    [29 * MIN, 1],
    [30 * MIN - 1, 1],
    [30 * MIN, 2],
    [59 * MIN, 2],
    [60 * MIN, 3],
    [119 * MIN, 3],
    [120 * MIN, 4],
  ])('%i ms of Watch time is Tier %i', (ms, tier) => {
    const { engine } = setup();
    watchFor(engine, ms, T0);
    expect(engine.getState().tier).toBe(tier);
  });

  it('reflects a video that is still playing', () => {
    const { engine, advanceTo } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: T0 });
    advanceTo(T0 + 30 * MIN);
    expect(engine.getState().tier).toBe(2);
  });
});

describe('Tier is the higher of count tier and time tier', () => {
  it('uses the time tier when count is Tier 1 and time is Tier 3', () => {
    const { engine } = setup();
    watchVideos(engine, 10, T0); // count Tier 1, 50s
    watchFor(engine, 60 * MIN, T0 + 10 * MIN); // time Tier 3
    const state = engine.getState();
    expect(state.totals.watchedVideos).toBe(11);
    expect(state.tier).toBe(3);
  });

  it('uses the count tier when count is Tier 4 and time is Tier 1', () => {
    const { engine } = setup();
    watchVideos(engine, 120, T0); // exactly 10 min
    expect(engine.getState().tier).toBe(4);
  });
});

describe('custom thresholds', () => {
  const thresholds = { videos: [2, 4, 6, 8], minutes: [1, 2, 3, 4] } as const;

  it('applies custom video thresholds', () => {
    const { engine } = setup({ thresholds });
    watchVideos(engine, 5, T0);
    expect(engine.getState().tier).toBe(2);
  });

  it('applies custom minute thresholds', () => {
    const { engine } = setup({ thresholds });
    watchFor(engine, 3 * MIN, T0);
    expect(engine.getState().tier).toBe(3);
  });

  it('can be changed on a running engine', () => {
    const { engine } = setup();
    watchVideos(engine, 10, T0);
    expect(engine.getState().tier).toBe(1);
    engine.configure({ thresholds: { videos: [20, 30, 60, 120], minutes: [10, 30, 60, 120] } });
    expect(engine.getState().tier).toBe(0);
  });
});

describe('Day rollover at 04:00 local time', () => {
  it('labels the Day by its calendar date', () => {
    const { engine } = setup();
    watchFor(engine, MIN, T0);
    expect(engine.getState().day).toBe('2026-01-10');
  });

  it('keeps a 00:30 session in the previous Day', () => {
    const start = local(2026, 1, 10, 0, 30);
    const { engine, advanceTo } = setup({}, start);
    watchFor(engine, 10 * MIN, start);
    advanceTo(local(2026, 1, 10, 0, 45));
    const state = engine.getState();
    expect(state.day).toBe('2026-01-09');
    expect(state.totals.watchTimeMs).toBe(10 * MIN);
  });

  it('does not roll over at 03:59 but does at 04:00', () => {
    const start = local(2026, 1, 9, 23);
    const { engine, ended } = setup({}, start);
    watchFor(engine, 5 * MIN, start);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 10, 3, 59) });
    expect(engine.getState().day).toBe('2026-01-09');
    expect(engine.getState().totals.watchedVideos).toBe(1);
    expect(ended).toHaveLength(0);

    engine.handle({ type: 'screenOn', at: local(2026, 1, 10, 4, 0) });
    const state = engine.getState();
    expect(state.day).toBe('2026-01-10');
    expect(state.totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
    expect(ended).toHaveLength(1);
    expect(ended[0].day).toBe('2026-01-09');
    expect(ended[0].state.totals.watchTimeMs).toBe(5 * MIN);
  });

  it('splits a scrolling session that crosses 04:00 into two Days', () => {
    const start = local(2026, 1, 10, 3, 59, 50);
    const { engine, ended, advanceTo } = setup({}, start);
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: start });
    engine.handle({ type: 'videoChanged', platform: 'tiktok', at: local(2026, 1, 10, 3, 59, 56) });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: local(2026, 1, 10, 4, 0, 20) });

    // Day 1: a 6s Watched video plus 4s of the next one that was cut by the boundary.
    expect(ended).toHaveLength(1);
    expect(ended[0].day).toBe('2026-01-09');
    expect(ended[0].state.totals).toEqual({ watchedVideos: 1, watchTimeMs: 10_000 });

    // Day 2: the video restarts at 04:00 and runs 20s.
    advanceTo(local(2026, 1, 10, 4, 1));
    const state = engine.getState();
    expect(state.day).toBe('2026-01-10');
    expect(state.totals).toEqual({ watchedVideos: 1, watchTimeMs: 20_000 });
  });

  it('does not count a sub-threshold remainder before the boundary as a Watched video', () => {
    const start = local(2026, 1, 10, 3, 59, 58);
    const { engine, ended } = setup({}, start);
    engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: start });
    engine.handle({ type: 'surfaceFocusLost', platform: 'youtube', at: local(2026, 1, 10, 4, 0, 10) });
    expect(ended[0].state.totals).toEqual({ watchedVideos: 0, watchTimeMs: 2000 });
    expect(engine.getState().totals).toEqual({ watchedVideos: 1, watchTimeMs: 10_000 });
  });

  it('rolls over when only the clock advances, without events', () => {
    const start = local(2026, 1, 10, 3, 0);
    const { engine, ended, advanceTo } = setup({}, start);
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: start });
    advanceTo(local(2026, 1, 10, 5, 0));
    const state = engine.getState();
    expect(state.day).toBe('2026-01-10');
    expect(state.totals.watchTimeMs).toBe(60 * MIN);
    expect(ended).toHaveLength(1);
    expect(ended[0].state.totals.watchTimeMs).toBe(60 * MIN);
  });

  it('resets everything after a quiet gap of several Days', () => {
    const { engine, ended } = setup({}, T0);
    watchFor(engine, 5 * MIN, T0);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 14, 9) });
    expect(engine.getState().day).toBe('2026-01-14');
    expect(engine.getState().totals.watchTimeMs).toBe(0);
    expect(ended).toHaveLength(1);
    expect(ended[0].day).toBe('2026-01-10');
  });

  it('does not accrue across the boundary while the screen is off', () => {
    const start = local(2026, 1, 10, 3, 0);
    const { engine, advanceTo } = setup({}, start);
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: start });
    engine.handle({ type: 'screenOff', at: local(2026, 1, 10, 3, 30) });
    advanceTo(local(2026, 1, 10, 6, 0));
    const state = engine.getState();
    expect(state.day).toBe('2026-01-10');
    expect(state.totals.watchTimeMs).toBe(0);
  });

  it('starts the new Day at Tier 0', () => {
    const start = local(2026, 1, 9, 20);
    const { engine } = setup({}, start);
    watchFor(engine, 130 * MIN, start);
    expect(engine.getState().tier).toBe(4);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 10, 4, 5) });
    expect(engine.getState().tier).toBe(0);
  });
});

describe('configurable rollover hour', () => {
  it('rolls over at the configured hour instead of 04:00', () => {
    const start = local(2026, 1, 10, 5, 0);
    const { engine } = setup({ rolloverHour: 6 }, start);
    watchFor(engine, MIN, start);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 10, 5, 59) });
    expect(engine.getState().day).toBe('2026-01-09');
    expect(engine.getState().totals.watchTimeMs).toBe(MIN);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 10, 6, 0) });
    expect(engine.getState().day).toBe('2026-01-10');
    expect(engine.getState().totals.watchTimeMs).toBe(0);
  });

  it('supports midnight as the rollover hour', () => {
    const start = local(2026, 1, 10, 23, 0);
    const { engine } = setup({ rolloverHour: 0 }, start);
    watchFor(engine, MIN, start);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 11, 0, 0) });
    expect(engine.getState().day).toBe('2026-01-11');
    expect(engine.getState().totals.watchTimeMs).toBe(0);
  });

  it('can be changed on a running engine and applies from then on', () => {
    const { engine } = setup({}, T0);
    watchFor(engine, MIN, T0);
    engine.configure({ rolloverHour: 6 });
    engine.handle({ type: 'screenOn', at: local(2026, 1, 11, 4, 30) });
    expect(engine.getState().day).toBe('2026-01-10');
    expect(engine.getState().totals.watchTimeMs).toBe(MIN);
    engine.handle({ type: 'screenOn', at: local(2026, 1, 11, 6, 0) });
    expect(engine.getState().day).toBe('2026-01-11');
  });

  it.each([-1, 24, 4.5, Number.NaN])('rejects rollover hour %p', (hour) => {
    expect(() => setup({ rolloverHour: hour })).toThrow(RangeError);
  });
});

describe('no manual reset', () => {
  it('exposes no reset in the engine interface', () => {
    const { engine } = setup();
    expect(Object.keys(engine).sort()).toEqual(['configure', 'getState', 'handle']);
  });
});
