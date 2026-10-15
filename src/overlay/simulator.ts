import type { Clock, EngineState, Platform } from '../engine';
import type { DetectionRunner } from '../detection/detectionRunner';

const SECONDS_PER_VIDEO = 6_000;
const MS_PER_MINUTE = 60_000;

/** The real clock plus a debug-only skew, so the simulator can fast-forward. */
export interface SkewClock extends Clock {
  advance(ms: number): void;
}

export function createSkewClock(base: () => number = Date.now): SkewClock {
  let skew = 0;
  return {
    now: () => base() + skew,
    advance(ms) {
      skew += ms;
    },
  };
}

export interface Simulator {
  getState(): EngineState;
  /** Watch `n` more videos, each long enough to count as a Watched video. */
  addVideos(n: number): void;
  /** Spend `n` more minutes on the current video. */
  addMinutes(n: number): void;
  /** Leave the simulated Short-form surface, as if the user switched apps. */
  stop(): void;
}

/**
 * Debug-only: feeds simulated raw events into the same detection runner the
 * AccessibilityService feeds, on a fast-forwardable clock. Real detection and
 * the simulator therefore share one engine and one pill.
 */
export function createSimulator(
  runner: DetectionRunner,
  clock: SkewClock,
  options: { platform?: Platform } = {},
): Simulator {
  const platform = options.platform ?? 'tiktok';

  function ensureSurface() {
    if (runner.activePlatform() !== platform) {
      runner.handle({ type: 'surfaceFocusGained', platform });
    }
  }

  return {
    getState: () => runner.getState(),
    addVideos(n) {
      ensureSurface();
      for (let i = 0; i < n; i += 1) {
        clock.advance(SECONDS_PER_VIDEO);
        runner.handle({ type: 'videoChanged', platform });
      }
    },
    addMinutes(n) {
      ensureSurface();
      clock.advance(n * MS_PER_MINUTE);
      // Nudge the runner so the pill redraws with the new time.
      runner.handle({ type: 'detectionHealthy', platform });
    },
    stop() {
      runner.handle({ type: 'surfaceFocusLost', platform });
    },
  };
}
