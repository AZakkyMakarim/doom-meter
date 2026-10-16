import type { PillViewModel } from '../overlay/pillViewModel';
import { createDetectionRunner } from './detectionRunner';

const START = 1_700_000_000_000;

function setup(options: { pillEnabled?: boolean } = {}) {
  let now = START;
  const rendered: PillViewModel[] = [];
  let hides = 0;
  const runner = createDetectionRunner({
    clock: { now: () => now },
    pill: {
      render: (pill) => rendered.push(pill),
      hide: () => {
        hides += 1;
      },
    },
    tickMs: 1000,
    pillEnabled: options.pillEnabled,
  });
  const advance = (ms: number) => {
    now += ms;
    jest.advanceTimersByTime(ms);
  };
  return { runner, rendered, advance, hides: () => hides };
}

describe('detection runner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the pill only while a Short-form surface is active', () => {
    const { runner, rendered, hides } = setup();
    expect(rendered).toHaveLength(0);

    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    expect(rendered).toHaveLength(1);
    expect(runner.isPillShown()).toBe(true);

    runner.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
    expect(runner.isPillShown()).toBe(false);
    expect(hides()).toBe(1);
  });

  it('counts a video after 5 seconds and not a faster skip', () => {
    const { runner, advance } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });

    for (let i = 0; i < 10; i += 1) {
      advance(2_000);
      runner.handle({ type: 'videoChanged', platform: 'tiktok' });
    }
    expect(runner.getState().totals.watchedVideos).toBe(0);
    expect(runner.getState().totals.watchTimeMs).toBe(20_000);

    for (let i = 0; i < 10; i += 1) {
      advance(6_000);
      runner.handle({ type: 'videoChanged', platform: 'tiktok' });
    }
    expect(runner.getState().totals.watchedVideos).toBe(10);
  });

  it('keeps the pill time moving while a video plays, without any event', () => {
    const { runner, rendered, advance } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    advance(3_000);
    const last = rendered[rendered.length - 1];
    expect(last.timeText).toBe('00:03');
    advance(7_000);
    expect(rendered[rendered.length - 1].timeText).toBe('00:10');
    expect(rendered[rendered.length - 1].countText).toBe('1');
  });

  it('stops redrawing once the pill is hidden', () => {
    const { runner, rendered, advance } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    runner.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
    const before = rendered.length;
    advance(10_000);
    expect(rendered).toHaveLength(before);
  });

  it('hides when the screen turns off and returns when it turns on', () => {
    const { runner } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    runner.handle({ type: 'screenOff' });
    expect(runner.isPillShown()).toBe(false);
    runner.handle({ type: 'screenOn' });
    expect(runner.isPillShown()).toBe(true);
  });

  it('follows the foreground when one Platform replaces another', () => {
    const { runner } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    runner.handle({ type: 'surfaceFocusGained', platform: 'youtube' });
    expect(runner.activePlatform()).toBe('youtube');
    // A late "lost" from the old Platform must not hide the new surface.
    runner.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
    expect(runner.activePlatform()).toBe('youtube');
    expect(runner.isPillShown()).toBe(true);
  });

  it('keeps counting but draws nothing while the overlay is turned off', () => {
    const { runner, rendered, advance } = setup({ pillEnabled: false });
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    advance(6_000);
    runner.handle({ type: 'videoChanged', platform: 'tiktok' });
    expect(rendered).toHaveLength(0);
    expect(runner.getState().totals.watchedVideos).toBe(1);

    runner.setPillEnabled(true);
    expect(runner.isPillShown()).toBe(true);
    expect(rendered).toHaveLength(1);
  });

  it('notifies subscribers on every event and stops after unsubscribe', () => {
    const { runner } = setup();
    const listener = jest.fn();
    const unsubscribe = runner.subscribe(listener);
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    runner.handle({ type: 'videoChanged', platform: 'tiktok' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not replay a Tier change when the pill comes back', () => {
    const { runner, rendered, advance } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    for (let i = 0; i < 10; i += 1) {
      advance(6_000);
      runner.handle({ type: 'videoChanged', platform: 'tiktok' });
    }
    expect(rendered.some((p) => p.tierChange === 'increase')).toBe(true);
    runner.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    expect(rendered[rendered.length - 1].tierChange).toBe('none');
  });

  it('stop() ends the redraw timer', () => {
    const { runner, rendered, advance } = setup();
    runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    runner.stop();
    const before = rendered.length;
    advance(5_000);
    expect(rendered).toHaveLength(before);
  });
});
