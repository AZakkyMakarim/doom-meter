export const PLATFORMS = ['instagram', 'youtube', 'tiktok'] as const;

/** One of the three sources of short-form video (see CONTEXT.md). */
export type Platform = (typeof PLATFORMS)[number];

/** Injectable time source, in epoch milliseconds. */
export interface Clock {
  now(): number;
}

/**
 * Raw events fed in by the detection adapters. Adapters know nothing about
 * counting rules; they only report what the UI is doing.
 *
 * `at` is the event timestamp in epoch milliseconds. When omitted, the
 * engine stamps the event with `clock.now()`.
 */
export type EngineEvent =
  /** The swipe feed of a Short-form surface became visible with the main video in focus. */
  | { type: 'surfaceFocusGained'; platform: Platform; at?: number }
  /** The feed lost focus (comments, creator profile, other screen, app left). */
  | { type: 'surfaceFocusLost'; platform: Platform; at?: number }
  /** The user swiped to the next video inside the active feed. */
  | { type: 'videoChanged'; platform: Platform; at?: number }
  | { type: 'screenOn'; at?: number }
  | { type: 'screenOff'; at?: number }
  /** Video detection for a Platform is responding again. */
  | { type: 'detectionHealthy'; platform: Platform; at?: number }
  /** Video detection for a Platform stopped responding. */
  | { type: 'detectionFailed'; platform: Platform; at?: number };

export interface PlatformState {
  /** Watched videos: videos that stayed on screen for at least the threshold. */
  watchedVideos: number;
  /** Watch time in milliseconds. */
  watchTimeMs: number;
  detectionHealthy: boolean;
}

export interface Totals {
  watchedVideos: number;
  watchTimeMs: number;
}

export interface EngineState {
  platforms: Record<Platform, PlatformState>;
  totals: Totals;
}

export interface CountingEngineOptions {
  clock: Clock;
  /** Time a video must stay on screen to count as a Watched video. Default 5000. */
  watchedThresholdMs?: number;
}

export interface CountingEngine {
  /** Feed one event into the engine. Malformed or out-of-order events never throw. */
  handle(event: EngineEvent): void;
  /** Current state, including the time of videos that are still playing. */
  getState(): EngineState;
}
