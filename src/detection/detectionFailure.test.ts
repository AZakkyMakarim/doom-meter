import { createDetectionRunner } from './detectionRunner';
import { parseRawEvent } from './rawEvent';

const START = 1_700_000_000_000;

function setup() {
  let now = START;
  const runner = createDetectionRunner({
    clock: { now: () => now },
    pill: { render: () => undefined, hide: () => undefined },
    tickMs: 1000,
  });
  const advance = (ms: number) => {
    now += ms;
    jest.advanceTimersByTime(ms);
  };
  return { runner, advance };
}

describe('detection runner: detection failure', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps Watch time, invents no count and flags the Day when the service is turned off in TikTok', () => {
    const { runner, advance } = setup();
    runner.handle({ type: 'usageForegroundStarted', platform: 'tiktok' });
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    advance(10_000);
    // What native sends when the user switches the Accessibility service off.
    runner.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
    runner.handle({ type: 'accessibilityDisconnected', platform: 'tiktok' });
    advance(60_000);

    const tiktok = runner.getState().platforms.tiktok;
    expect(tiktok.detectionHealthy).toBe(false);
    expect(tiktok.incomplete).toBe(true);
    expect(tiktok.watchedVideos).toBe(1);
    // 10s from the surface, then the minute since the service went away, from UsageStats.
    expect(tiktok.watchTimeMs).toBe(70_000);

    advance(30_000);
    runner.handle({ type: 'usageForegroundEnded', platform: 'tiktok' });
    expect(runner.getState().platforms.tiktok.watchTimeMs).toBe(100_000);
    expect(runner.getState().platforms.tiktok.watchedVideos).toBe(1);
  });

  it('counts nothing without UsageStats: the failure is flagged and no time is added', () => {
    const { runner, advance } = setup();
    runner.handle({ type: 'accessibilityDisconnected', platform: 'tiktok' });
    advance(120_000);

    const state = runner.getState();
    expect(state.platforms.tiktok.detectionHealthy).toBe(false);
    expect(state.platforms.tiktok.incomplete).toBe(true);
    expect(state.totals).toEqual({ watchedVideos: 0, watchTimeMs: 0 });
  });

  it('recovers and counts videos again when the service is back, keeping the Day incomplete', () => {
    const { runner, advance } = setup();
    runner.handle({ type: 'accessibilityDisconnected', platform: 'tiktok' });
    runner.handle({ type: 'accessibilityConnected' });
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    advance(6_000);
    runner.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });

    const tiktok = runner.getState().platforms.tiktok;
    expect(tiktok.detectionHealthy).toBe(true);
    expect(tiktok.incomplete).toBe(true);
    expect(tiktok.watchedVideos).toBe(1);
  });

  it('fails a Platform app that stays in the foreground with no surface, on tick', () => {
    const { runner, advance } = setup();
    runner.handle({ type: 'usageForegroundStarted', platform: 'instagram' });
    advance(29 * 60_000);
    runner.tick();
    expect(runner.getState().platforms.instagram.detectionHealthy).toBe(true);

    advance(60_000);
    runner.tick();
    expect(runner.getState().platforms.instagram.detectionHealthy).toBe(false);
  });
});

describe('parseRawEvent: detection health facts', () => {
  it('parses UsageStats foreground events', () => {
    expect(parseRawEvent('{"type":"usageForegroundStarted","platform":"tiktok","at":9}')).toEqual({
      type: 'usageForegroundStarted',
      platform: 'tiktok',
      at: 9,
    });
    expect(parseRawEvent('{"type":"usageForegroundEnded","platform":"youtube"}')).toEqual({
      type: 'usageForegroundEnded',
      platform: 'youtube',
    });
    expect(parseRawEvent('{"type":"usageForegroundStarted"}')).toBeNull();
  });

  it('parses Accessibility service facts, with the Platform optional on a disconnect', () => {
    expect(parseRawEvent('{"type":"accessibilityConnected","at":1}')).toEqual({
      type: 'accessibilityConnected',
      at: 1,
    });
    expect(parseRawEvent('{"type":"accessibilityDisconnected","at":2}')).toEqual({
      type: 'accessibilityDisconnected',
      at: 2,
    });
    expect(
      parseRawEvent('{"type":"accessibilityDisconnected","platform":"instagram","at":2}'),
    ).toEqual({ type: 'accessibilityDisconnected', platform: 'instagram', at: 2 });
    expect(parseRawEvent('{"type":"accessibilityDisconnected","platform":"vine"}')).toEqual({
      type: 'accessibilityDisconnected',
    });
  });
});
