import { createCountingEngine } from '../engine';
import type { EngineState, Platform } from '../engine';

const SECONDS_PER_VIDEO = 6_000;
const MS_PER_MINUTE = 60_000;

export interface Simulator {
  getState(): EngineState;
  /** Watch `n` more videos, each long enough to count as a Watched video. */
  addVideos(n: number): void;
  /** Spend `n` more minutes on the current video. */
  addMinutes(n: number): void;
}

/**
 * Debug-only: drives the real Counting engine from simulated events on a manual
 * clock, standing in for the AccessibilityService until detection lands.
 */
export function createSimulator(
  options: { startAt?: number; platform?: Platform } = {},
): Simulator {
  const platform = options.platform ?? 'tiktok';
  let now = options.startAt ?? Date.now();
  const engine = createCountingEngine({ clock: { now: () => now } });
  engine.handle({ type: 'surfaceFocusGained', platform });

  return {
    getState: () => engine.getState(),
    addVideos(n) {
      for (let i = 0; i < n; i += 1) {
        now += SECONDS_PER_VIDEO;
        engine.handle({ type: 'videoChanged', platform });
      }
    },
    addMinutes(n) {
      now += n * MS_PER_MINUTE;
    },
  };
}
