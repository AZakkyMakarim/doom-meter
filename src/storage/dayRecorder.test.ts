import { createCountingEngine } from '../engine';
import type { DaySummary, EngineState, Platform } from '../engine';
import { createDayRecorder } from './dayRecorder';
import { createDayStore } from './dayStore';
import { createMemoryKeyValueStore } from './memoryKeyValueStore';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

function stateOf(
  day: string,
  tiktok: { watchedVideos: number; watchTimeMs: number; detectionHealthy?: boolean },
): EngineState {
  const zero = { watchedVideos: 0, watchTimeMs: 0, detectionHealthy: true };
  return {
    day,
    platforms: {
      instagram: zero,
      youtube: zero,
      tiktok: { detectionHealthy: true, ...tiktok },
    },
    totals: { watchedVideos: tiktok.watchedVideos, watchTimeMs: tiktok.watchTimeMs },
    tier: 0,
  };
}

function setup(options: { flushIntervalMs?: number; kv?: ReturnType<typeof createMemoryKeyValueStore> } = {}) {
  const kv = options.kv ?? createMemoryKeyValueStore();
  const store = createDayStore(kv);
  let now = 1_000_000;
  const recorder = createDayRecorder({
    store,
    now: () => now,
    flushIntervalMs: options.flushIntervalMs ?? 10_000,
  });
  return {
    kv,
    store,
    recorder,
    tick(ms: number) {
      now += ms;
    },
  };
}

describe('day recorder: flushing', () => {
  it('writes the first observation of new counts right away', async () => {
    const { store, recorder } = setup();
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000 }), false);
    await recorder.settled();

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(1);
  });

  it('throttles writes while the user keeps scrolling', async () => {
    const { store, recorder, tick } = setup();
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000 }), false);
    tick(3000);
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 2, watchTimeMs: 9000 }), false);
    await recorder.settled();
    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(1);

    tick(8000);
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 3, watchTimeMs: 17_000 }), false);
    await recorder.settled();
    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(3);
  });

  it('writes immediately when scrolling stops, so a kill right after loses nothing', async () => {
    const { store, recorder, tick } = setup();
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000 }), false);
    tick(1000);
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 2, watchTimeMs: 12_000 }), true);
    await recorder.settled();

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(2);
  });

  it('flush() writes the latest observed state at once (app goes to background)', async () => {
    const { store, recorder, tick } = setup();
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000 }), false);
    tick(1000);
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 4, watchTimeMs: 30_000 }), false);
    await recorder.flush();

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(4);
  });

  it('does not write again when nothing changed', async () => {
    const { kv, recorder, tick } = setup();
    const set = jest.spyOn(kv, 'set');
    const state = stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000 });
    recorder.observe(state, true);
    await recorder.settled();
    tick(60_000);
    recorder.observe(state, true);
    await recorder.flush();

    expect(set).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed write', async () => {
    const { kv, store, recorder, tick } = setup();
    const set = jest.spyOn(kv, 'set').mockRejectedValueOnce(new Error('disk full'));
    const state = stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000 });
    recorder.observe(state, true);
    await recorder.settled();
    expect(await store.getDay('2026-10-15')).toBeNull();

    tick(1000);
    recorder.observe(state, true);
    await recorder.settled();
    expect(set).toHaveBeenCalledTimes(2);
    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(1);
  });
});

describe('day recorder: incomplete flag', () => {
  it('marks a Platform incomplete once detection failed, even after it recovers', async () => {
    const { store, recorder, tick } = setup();
    recorder.observe(
      stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000, detectionHealthy: false }),
      false,
    );
    tick(1000);
    recorder.observe(stateOf('2026-10-15', { watchedVideos: 2, watchTimeMs: 12_000 }), true);
    await recorder.settled();

    const day = await store.getDay('2026-10-15');
    expect(day?.platforms.tiktok.incomplete).toBe(true);
    expect(day?.platforms.youtube.incomplete).toBe(false);
  });

  it('starts the next Day with a clean flag', async () => {
    const { store, recorder, tick } = setup();
    recorder.observe(
      stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 6000, detectionHealthy: false }),
      true,
    );
    tick(1000);
    recorder.observe(stateOf('2026-10-16', { watchedVideos: 1, watchTimeMs: 6000 }), true);
    await recorder.settled();

    expect((await store.getDay('2026-10-16'))?.platforms.tiktok.incomplete).toBe(false);
  });
});

describe('day recorder: Day end', () => {
  it('saves the final state of a Day that ended', async () => {
    const { store, recorder } = setup();
    const summary: DaySummary = {
      day: '2026-10-15',
      state: stateOf('2026-10-15', { watchedVideos: 40, watchTimeMs: 3_000_000 }),
    };
    recorder.onDayEnded(summary);
    await recorder.settled();

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(40);
  });

  it('marks the Day incomplete when detection was failing at its end', async () => {
    const { store, recorder } = setup();
    recorder.onDayEnded({
      day: '2026-10-15',
      state: stateOf('2026-10-15', { watchedVideos: 1, watchTimeMs: 1, detectionHealthy: false }),
    });
    await recorder.settled();

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.incomplete).toBe(true);
  });
});

describe('day recorder with the Counting engine across a process restart', () => {
  async function runProcess(
    kv: ReturnType<typeof createMemoryKeyValueStore>,
    nowMs: number,
    script: (engine: ReturnType<typeof createCountingEngine>, observe: () => void) => void,
  ) {
    const { recorder } = setupWith(kv);
    let now = nowMs;
    const engine = createCountingEngine({
      clock: { now: () => now },
      onDayEnded: recorder.onDayEnded,
    });
    await recorder.restoreInto(engine, nowMs);
    script(engine, () => recorder.observe(engine.getState(), true));
    await recorder.flush();
    return { engine, setNow: (t: number) => (now = t) };
  }

  function setupWith(kv: ReturnType<typeof createMemoryKeyValueStore>) {
    return setup({ kv });
  }

  function watch(engine: ReturnType<typeof createCountingEngine>, platform: Platform, from: number, ms: number) {
    engine.handle({ type: 'surfaceFocusGained', platform, at: from });
    engine.handle({ type: 'surfaceFocusLost', platform, at: from + ms });
  }

  it('shows the same numbers after the app is force-stopped and reopened', async () => {
    const kv = createMemoryKeyValueStore();
    await runProcess(kv, at(15, 12), (engine, observe) => {
      watch(engine, 'tiktok', at(15, 12), 6000);
      watch(engine, 'tiktok', at(15, 12, 1), 7000);
      observe();
    });

    // Process killed; a new process opens the same storage.
    const second = await runProcess(kv, at(15, 13), () => undefined);
    const state = second.engine.getState();
    expect(state.day).toBe('2026-10-15');
    expect(state.platforms.tiktok.watchedVideos).toBe(2);
    expect(state.platforms.tiktok.watchTimeMs).toBe(13_000);
  });

  it('keeps counting on top of the saved Day, then saves the sum', async () => {
    const kv = createMemoryKeyValueStore();
    await runProcess(kv, at(15, 12), (engine, observe) => {
      watch(engine, 'youtube', at(15, 12), 6000);
      observe();
    });
    await runProcess(kv, at(15, 13), (engine, observe) => {
      watch(engine, 'youtube', at(15, 13), 6000);
      observe();
    });

    const saved = await createDayStore(kv).getDay('2026-10-15');
    expect(saved?.platforms.youtube.watchedVideos).toBe(2);
    expect(saved?.platforms.youtube.watchTimeMs).toBe(12_000);
  });

  it('starts at zero in a new Day and keeps yesterday as its own record', async () => {
    const kv = createMemoryKeyValueStore();
    await runProcess(kv, at(15, 12), (engine, observe) => {
      watch(engine, 'tiktok', at(15, 12), 6000);
      observe();
    });
    const next = await runProcess(kv, at(16, 12), () => undefined);

    expect(next.engine.getState().totals.watchedVideos).toBe(0);
    const store = createDayStore(kv);
    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(1);
  });

  it('carries the incomplete flag across a restart within the same Day', async () => {
    const kv = createMemoryKeyValueStore();
    await runProcess(kv, at(15, 12), (engine, observe) => {
      engine.handle({ type: 'detectionFailed', platform: 'tiktok', at: at(15, 12) });
      observe();
      watch(engine, 'tiktok', at(15, 12), 6000);
      engine.handle({ type: 'detectionHealthy', platform: 'tiktok', at: at(15, 12, 2) });
      observe();
    });
    await runProcess(kv, at(15, 13), (engine, observe) => {
      watch(engine, 'tiktok', at(15, 13), 6000);
      observe();
    });

    expect((await createDayStore(kv).getDay('2026-10-15'))?.platforms.tiktok.incomplete).toBe(true);
  });
});
