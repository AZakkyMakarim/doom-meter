import { createCountingEngine } from './countingEngine';
import type { Clock, DaySummary, EngineEvent } from './types';

function setup() {
  let now = 0;
  const clock: Clock = { now: () => now };
  const ended: DaySummary[] = [];
  const engine = createCountingEngine({ clock, onDayEnded: (s) => ended.push(s) });
  return {
    engine,
    ended,
    advanceTo(t: number) {
      now = t;
    },
    send(...events: EngineEvent[]) {
      events.forEach((e) => engine.handle(e));
    },
  };
}

describe('detection failure: no count is invented', () => {
  it('keeps the time and count of the video in progress when detection fails', () => {
    const { engine, send } = setup();
    send(
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 0 },
      { type: 'detectionFailed', platform: 'tiktok', at: 10_000 },
    );

    const tiktok = engine.getState().platforms.tiktok;
    expect(tiktok.watchedVideos).toBe(1);
    expect(tiktok.watchTimeMs).toBe(10_000);
  });

  it('ignores surface and swipe events from a Platform whose detection is down', () => {
    const { engine, send, advanceTo } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 },
      { type: 'videoChanged', platform: 'tiktok', at: 8000 },
      { type: 'videoChanged', platform: 'tiktok', at: 16_000 },
    );
    advanceTo(30_000);

    const tiktok = engine.getState().platforms.tiktok;
    expect(tiktok.watchedVideos).toBe(0);
    expect(tiktok.watchTimeMs).toBe(0);
  });

  it('does not affect the counts of another Platform', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'youtube', at: 1000 },
      { type: 'surfaceFocusLost', platform: 'youtube', at: 7000 },
    );

    const state = engine.getState();
    expect(state.platforms.youtube.watchedVideos).toBe(1);
    expect(state.platforms.youtube.watchTimeMs).toBe(6000);
    expect(state.platforms.youtube.incomplete).toBe(false);
  });

  it('counts the video in focus when detection is healthy again, and the ones after it', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 },
      { type: 'detectionHealthy', platform: 'tiktok', at: 20_000 },
      { type: 'videoChanged', platform: 'tiktok', at: 23_000 },
      { type: 'surfaceFocusLost', platform: 'tiktok', at: 26_000 },
    );

    const tiktok = engine.getState().platforms.tiktok;
    expect(tiktok.watchedVideos).toBe(2);
    expect(tiktok.watchTimeMs).toBe(6000);
  });
});

describe('detection failure: recovery', () => {
  it('does not count again a video that was counted before the failure', () => {
    const { engine, send } = setup();
    send(
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 0 },
      { type: 'detectionFailed', platform: 'tiktok', at: 1000 },
      { type: 'detectionHealthy', platform: 'tiktok', at: 2000 },
    );

    expect(engine.getState().platforms.tiktok.watchedVideos).toBe(1);
  });
});

describe('detection failure: UsageStats Watch time', () => {
  it('adds foreground time as Watch time, with no count, while detection is down', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 5000 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 125_000 },
    );

    const state = engine.getState();
    expect(state.platforms.tiktok.watchTimeMs).toBe(120_000);
    expect(state.platforms.tiktok.watchedVideos).toBe(0);
    expect(state.totals).toEqual({ watchedVideos: 0, watchTimeMs: 120_000 });
  });

  it('shows the time of a foreground stint that is still running', () => {
    const { engine, send, advanceTo } = setup();
    send(
      { type: 'detectionFailed', platform: 'youtube', at: 0 },
      { type: 'usageForegroundStarted', platform: 'youtube', at: 0 },
    );
    advanceTo(90_000);

    const youtube = engine.getState().platforms.youtube;
    expect(youtube.watchTimeMs).toBe(90_000);
    expect(youtube.watchedVideos).toBe(0);
  });

  it('ignores UsageStats while detection is healthy, so time is never counted twice', () => {
    const { engine, send } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 },
      { type: 'surfaceFocusLost', platform: 'tiktok', at: 11_000 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 60_000 },
    );

    const tiktok = engine.getState().platforms.tiktok;
    expect(tiktok.watchTimeMs).toBe(10_000);
    expect(tiktok.watchedVideos).toBe(1);
  });

  it('counts only the time after the failure when the app was already in the foreground', () => {
    const { engine, send } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 0 },
      { type: 'detectionFailed', platform: 'tiktok', at: 30_000 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 90_000 },
    );

    expect(engine.getState().platforms.tiktok.watchTimeMs).toBe(60_000);
  });

  it('stops adding UsageStats time when detection recovers and hands over to the surface', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 },
      { type: 'detectionHealthy', platform: 'tiktok', at: 40_000 },
      { type: 'surfaceFocusLost', platform: 'tiktok', at: 50_000 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 80_000 },
    );

    const tiktok = engine.getState().platforms.tiktok;
    // 40s from UsageStats while down, then 10s from the surface once healthy.
    expect(tiktok.watchTimeMs).toBe(50_000);
    expect(tiktok.watchedVideos).toBe(1);
  });

  it('pauses UsageStats time while the screen is off', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 0 },
      { type: 'screenOff', at: 20_000 },
      { type: 'screenOn', at: 100_000 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 110_000 },
    );

    expect(engine.getState().platforms.tiktok.watchTimeMs).toBe(30_000);
  });

  it('keeps only one Platform in the foreground at a time', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'detectionFailed', platform: 'youtube', at: 0 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundStarted', platform: 'youtube', at: 30_000 },
      { type: 'usageForegroundEnded', platform: 'youtube', at: 50_000 },
    );

    const state = engine.getState();
    expect(state.platforms.tiktok.watchTimeMs).toBe(30_000);
    expect(state.platforms.youtube.watchTimeMs).toBe(20_000);
  });

  it('ignores an end event with no matching start', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 5000 },
    );

    expect(engine.getState().totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
  });

  it('splits a UsageStats stint at the Day boundary', () => {
    const rollover = new Date(2026, 9, 16, 4, 0).getTime();
    const { engine, ended, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: rollover - 60_000 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: rollover - 60_000 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: rollover + 30_000 },
    );

    expect(ended).toHaveLength(1);
    expect(ended[0].state.platforms.tiktok.watchTimeMs).toBe(60_000);
    expect(engine.getState().platforms.tiktok.watchTimeMs).toBe(30_000);
  });
});

describe('detection failure: the incomplete flag', () => {
  it('starts false', () => {
    const { engine } = setup();
    expect(engine.getState().platforms.tiktok.incomplete).toBe(false);
  });

  it('is set by a failure even when nothing was being watched, only for that Platform', () => {
    const { engine, send } = setup();
    send({ type: 'detectionFailed', platform: 'tiktok', at: 0 });

    const state = engine.getState();
    expect(state.platforms.tiktok.incomplete).toBe(true);
    expect(state.platforms.youtube.incomplete).toBe(false);
    expect(state.platforms.instagram.incomplete).toBe(false);
  });

  it('stays set for the Day after detection recovers', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'detectionHealthy', platform: 'tiktok', at: 1000 },
    );

    expect(engine.getState().platforms.tiktok.incomplete).toBe(true);
    expect(engine.getState().platforms.tiktok.detectionHealthy).toBe(true);
  });

  it('is reported on the Day that ended and cleared for the next Day once detection recovered', () => {
    const rollover = new Date(2026, 9, 16, 4, 0).getTime();
    const { engine, ended, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: rollover - 120_000 },
      { type: 'detectionHealthy', platform: 'tiktok', at: rollover - 60_000 },
      { type: 'screenOn', at: rollover + 1000 },
    );

    expect(ended[0].state.platforms.tiktok.incomplete).toBe(true);
    expect(engine.getState().platforms.tiktok.incomplete).toBe(false);
  });

  it('carries into the next Day while detection is still down', () => {
    const rollover = new Date(2026, 9, 16, 4, 0).getTime();
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'tiktok', at: rollover - 60_000 },
      { type: 'screenOn', at: rollover + 1000 },
    );

    expect(engine.getState().platforms.tiktok.incomplete).toBe(true);
  });

  it('is restored with the saved Day, and a saved false never clears a live failure', () => {
    const { engine, send } = setup();
    send({ type: 'detectionFailed', platform: 'youtube', at: 0 });
    engine.restore({
      day: engine.getState().day,
      platforms: {
        instagram: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        youtube: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
        tiktok: { watchedVideos: 3, watchTimeMs: 1000, incomplete: true },
        facebook: { watchedVideos: 0, watchTimeMs: 0, incomplete: false },
      },
    });

    const state = engine.getState();
    expect(state.platforms.tiktok.incomplete).toBe(true);
    expect(state.platforms.youtube.incomplete).toBe(true);
    expect(state.platforms.instagram.incomplete).toBe(false);
  });

  it('is set when UsageStats time is added, because the count is missing for that time', () => {
    const { engine, send } = setup();
    send(
      { type: 'detectionFailed', platform: 'instagram', at: 0 },
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'usageForegroundEnded', platform: 'instagram', at: 10_000 },
      { type: 'detectionHealthy', platform: 'instagram', at: 20_000 },
    );

    expect(engine.getState().platforms.instagram.incomplete).toBe(true);
  });
});
