import { createCountingEngine } from './countingEngine';
import type { Clock } from './types';

function setup(options: { watchedThresholdMs?: number } = {}) {
  let now = 0;
  const clock: Clock = { now: () => now };
  const engine = createCountingEngine({ clock, ...options });
  return {
    engine,
    advanceTo(t: number) {
      now = t;
    },
  };
}

describe('Watched video threshold', () => {
  it('does not count a video that stays 4.9s', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 4900 });

    const state = engine.getState();
    expect(state.platforms.tiktok.watchedVideos).toBe(0);
    expect(state.totals.watchedVideos).toBe(0);
  });

  it('counts a video that stays exactly 5.0s', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 5000 });

    const state = engine.getState();
    expect(state.platforms.tiktok.watchedVideos).toBe(1);
    expect(state.totals.watchedVideos).toBe(1);
  });

  it('counts a video live once it is past the threshold, before it ends', () => {
    const { engine, advanceTo } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: 0 });

    advanceTo(4999);
    expect(engine.getState().totals.watchedVideos).toBe(0);

    advanceTo(5000);
    expect(engine.getState().totals.watchedVideos).toBe(1);
  });

  it('honours a configured threshold', () => {
    const { engine } = setup({ watchedThresholdMs: 2000 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 2000 });

    expect(engine.getState().totals.watchedVideos).toBe(1);
  });
});

describe('Watch time', () => {
  it('adds a skipped video to Watch time only', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: 0 });
    engine.handle({ type: 'videoChanged', platform: 'instagram', at: 1500 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'instagram', at: 3000 });

    const { platforms, totals } = engine.getState();
    expect(platforms.instagram.watchedVideos).toBe(0);
    expect(platforms.instagram.watchTimeMs).toBe(3000);
    expect(totals.watchTimeMs).toBe(3000);
  });

  it('counts each video separately when the user swipes on', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: 0 });
    engine.handle({ type: 'videoChanged', platform: 'instagram', at: 6000 });
    engine.handle({ type: 'videoChanged', platform: 'instagram', at: 8000 });
    engine.handle({ type: 'videoChanged', platform: 'instagram', at: 14000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'instagram', at: 14000 });

    const { platforms } = engine.getState();
    expect(platforms.instagram.watchedVideos).toBe(2);
    expect(platforms.instagram.watchTimeMs).toBe(14000);
  });

  it('includes the running time of the active video in getState', () => {
    const { engine, advanceTo } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 });
    advanceTo(3500);

    expect(engine.getState().platforms.tiktok.watchTimeMs).toBe(2500);
  });

  it('stops accruing when the surface is lost (comments or profile)', () => {
    const { engine, advanceTo } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 10000 });
    advanceTo(60000);

    const { platforms } = engine.getState();
    expect(platforms.tiktok.watchTimeMs).toBe(10000);
    expect(platforms.tiktok.watchedVideos).toBe(1);
  });

  it('starts a fresh video when the feed is regained after comments', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 3000 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 20000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 23000 });

    const { platforms } = engine.getState();
    expect(platforms.tiktok.watchTimeMs).toBe(6000);
    expect(platforms.tiktok.watchedVideos).toBe(0);
  });
});

describe('screen on and off', () => {
  it('pauses both counters while the screen is off', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: 0 });
    engine.handle({ type: 'screenOff', at: 4000 });
    engine.handle({ type: 'screenOn', at: 64000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'youtube', at: 65000 });

    const { platforms } = engine.getState();
    expect(platforms.youtube.watchTimeMs).toBe(5000);
    // 4s + 1s are two separate stretches of video, neither reaches 5s.
    expect(platforms.youtube.watchedVideos).toBe(0);
  });

  it('does not accrue while off even if queried with the clock far ahead', () => {
    const { engine, advanceTo } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: 0 });
    engine.handle({ type: 'screenOff', at: 7000 });
    advanceTo(1_000_000);

    const { platforms } = engine.getState();
    expect(platforms.youtube.watchTimeMs).toBe(7000);
    expect(platforms.youtube.watchedVideos).toBe(1);
  });

  it('does not accrue when the feed gains focus while the screen is off', () => {
    const { engine } = setup();
    engine.handle({ type: 'screenOff', at: 0 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: 1000 });
    engine.handle({ type: 'screenOn', at: 11000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'youtube', at: 13000 });

    expect(engine.getState().platforms.youtube.watchTimeMs).toBe(2000);
  });
});

describe('per Platform breakdown', () => {
  it('keeps count and time separate per Platform and sums totals', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: 0 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'instagram', at: 6000 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'youtube', at: 10000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'youtube', at: 12000 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 20000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 30000 });

    const { platforms, totals } = engine.getState();
    expect(platforms.instagram).toMatchObject({ watchedVideos: 1, watchTimeMs: 6000 });
    expect(platforms.youtube).toMatchObject({ watchedVideos: 0, watchTimeMs: 2000 });
    expect(platforms.tiktok).toMatchObject({ watchedVideos: 1, watchTimeMs: 10000 });
    expect(totals).toEqual({ watchedVideos: 2, watchTimeMs: 18000 });
  });

  it('starts with zeroes for every Platform', () => {
    const { engine } = setup();
    const { platforms, totals } = engine.getState();
    for (const p of ['instagram', 'youtube', 'tiktok'] as const) {
      expect(platforms[p]).toMatchObject({ watchedVideos: 0, watchTimeMs: 0 });
    }
    expect(totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
  });

  it('ends the previous Platform when another gains focus without a loss event', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'instagram', at: 0 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 6000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 8000 });

    const { platforms, totals } = engine.getState();
    expect(platforms.instagram).toMatchObject({ watchedVideos: 1, watchTimeMs: 6000 });
    expect(platforms.tiktok.watchTimeMs).toBe(2000);
    expect(totals.watchTimeMs).toBe(8000);
  });
});

describe('detection health', () => {
  it('reports detection as healthy by default and tracks failed/healthy events', () => {
    const { engine } = setup();
    expect(engine.getState().platforms.youtube.detectionHealthy).toBe(true);

    engine.handle({ type: 'detectionFailed', platform: 'youtube', at: 1000 });
    expect(engine.getState().platforms.youtube.detectionHealthy).toBe(false);
    expect(engine.getState().platforms.tiktok.detectionHealthy).toBe(true);

    engine.handle({ type: 'detectionHealthy', platform: 'youtube', at: 2000 });
    expect(engine.getState().platforms.youtube.detectionHealthy).toBe(true);
  });
});

describe('malformed event streams', () => {
  it('ignores a surface loss that has no matching gain', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 5000 });

    expect(engine.getState().totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
  });

  it('ignores a duplicate gain without restarting the video', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 3000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 5000 });

    const { platforms } = engine.getState();
    expect(platforms.tiktok.watchTimeMs).toBe(5000);
    expect(platforms.tiktok.watchedVideos).toBe(1);
  });

  it('never yields negative time when events arrive out of order', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 10000 });
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 4000 });
    engine.handle({ type: 'screenOff', at: 1000 });
    engine.handle({ type: 'screenOn', at: 500 });

    const { platforms, totals } = engine.getState();
    expect(platforms.tiktok.watchTimeMs).toBeGreaterThanOrEqual(0);
    expect(totals.watchTimeMs).toBeGreaterThanOrEqual(0);
    expect(totals.watchedVideos).toBeGreaterThanOrEqual(0);
  });

  it('treats a late event as happening at the latest known time', () => {
    const { engine } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 0 });
    engine.handle({ type: 'videoChanged', platform: 'tiktok', at: 8000 });
    // Stale loss stamped before the swipe: clamped to 8000, so the new video lasted 0s.
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok', at: 6000 });

    const { platforms } = engine.getState();
    expect(platforms.tiktok.watchTimeMs).toBe(8000);
    expect(platforms.tiktok.watchedVideos).toBe(1);
  });

  it('does not go negative when the clock is behind the latest event', () => {
    const { engine, advanceTo } = setup();
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok', at: 10000 });
    advanceTo(2000);

    expect(engine.getState().platforms.tiktok.watchTimeMs).toBe(0);
  });

  it('ignores videoChanged, screenOn and screenOff that change nothing', () => {
    const { engine } = setup();
    engine.handle({ type: 'videoChanged', platform: 'tiktok', at: 1000 });
    engine.handle({ type: 'screenOn', at: 2000 });
    engine.handle({ type: 'screenOff', at: 3000 });
    engine.handle({ type: 'screenOff', at: 4000 });

    expect(engine.getState().totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
  });

  it('defaults event time to the injected clock', () => {
    const { engine, advanceTo } = setup();
    advanceTo(1000);
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    advanceTo(7000);
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });

    expect(engine.getState().platforms.tiktok).toMatchObject({
      watchedVideos: 1,
      watchTimeMs: 6000,
    });
  });
});
