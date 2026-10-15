import { createCountingEngine } from '../engine';
import { createDayRecorder } from './dayRecorder';
import { createDayStore } from './dayStore';
import { createMemoryKeyValueStore } from './memoryKeyValueStore';

const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m).getTime();

describe('day recorder: detection failure', () => {
  it('stores the Day as incomplete when detection failed and recovered between two observations', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    const recorder = createDayRecorder({ store, now: () => 0 });
    const engine = createCountingEngine({ clock: { now: () => at(12, 10) } });
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: at(12) });
    engine.handle({ type: 'detectionFailed', platform: 'tiktok', at: at(12, 1) });
    engine.handle({ type: 'detectionHealthy', platform: 'tiktok', at: at(12, 2) });

    recorder.observe(engine.getState(), true);
    await recorder.settled();

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.incomplete).toBe(true);
  });

  it('keeps UsageStats Watch time, with no count, in the stored Day', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    const recorder = createDayRecorder({ store, now: () => 0 });
    const engine = createCountingEngine({ clock: { now: () => at(12, 30) } });
    engine.handle({ type: 'detectionFailed', platform: 'youtube', at: at(12) });
    engine.handle({ type: 'usageForegroundStarted', platform: 'youtube', at: at(12) });
    engine.handle({ type: 'usageForegroundEnded', platform: 'youtube', at: at(12, 20) });

    recorder.observe(engine.getState(), true);
    await recorder.settled();

    const saved = (await store.getDay('2026-10-15'))?.platforms.youtube;
    expect(saved).toEqual({ watchedVideos: 0, watchTimeMs: 20 * 60_000, incomplete: true });
  });
});
