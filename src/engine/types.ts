import type { Platform } from '../design/catalog';

export { PLATFORMS } from '../design/catalog';
export type { Platform };

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
  /**
   * The swipe feed of a Short-form surface became visible with the main video in focus. Counts
   * that video as a Watched video, unless `sameVideo` says it is the one the user left
   * (back from comments or a creator profile).
   */
  | { type: 'surfaceFocusGained'; platform: Platform; sameVideo?: boolean; at?: number }
  /** The feed lost focus (comments, creator profile, other screen, app left). */
  | { type: 'surfaceFocusLost'; platform: Platform; at?: number }
  /** The user swiped to the next video inside the active feed. */
  | { type: 'videoChanged'; platform: Platform; at?: number }
  | { type: 'screenOn'; at?: number }
  | { type: 'screenOff'; at?: number }
  /** Video detection for a Platform is responding again. */
  | { type: 'detectionHealthy'; platform: Platform; at?: number }
  /** Video detection for a Platform stopped responding. */
  | { type: 'detectionFailed'; platform: Platform; at?: number }
  /**
   * UsageStats says the Platform's app came to the foreground. Counts as Watch time only
   * while detection for that Platform is failed; never as a Watched video.
   */
  | { type: 'usageForegroundStarted'; platform: Platform; at?: number }
  /** UsageStats says the Platform's app left the foreground. */
  | { type: 'usageForegroundEnded'; platform: Platform; at?: number };

export interface PlatformState {
  /** Watched videos: videos that came into focus on a Short-form surface. */
  watchedVideos: number;
  /** Watch time in milliseconds. */
  watchTimeMs: number;
  detectionHealthy: boolean;
  /**
   * Detection failed for this Platform at some point in the Day, so counts may be low.
   * Sticky for the Day; a new Day starts incomplete only if detection is still down.
   */
  incomplete: boolean;
}

export interface Totals {
  watchedVideos: number;
  watchTimeMs: number;
}

/** Severity level 0-4 (Vibing, Cooked, Washed, Brainrot, Doomed). */
export type Tier = 0 | 1 | 2 | 3 | 4;

/** Lower bounds (inclusive) for Tiers 1 to 4, ascending. */
export type TierBounds = readonly [number, number, number, number];

export interface TierThresholds {
  /** Watched video count at which Tiers 1-4 begin. */
  videos: TierBounds;
  /** Minutes of Watch time at which Tiers 1-4 begin. */
  minutes: TierBounds;
}

export interface EngineState {
  /** The current Day, as the local calendar date it started on (YYYY-MM-DD). */
  day: string;
  platforms: Record<Platform, PlatformState>;
  totals: Totals;
  /** Higher of the count Tier and the time Tier for the current Day. */
  tier: Tier;
}

/** A finished Day, handed out when the Day rolls over. */
export interface DaySummary {
  day: string;
  state: EngineState;
}

/** The counts saved for a Day, used to pick the Day back up after the process restarts. */
export interface DaySnapshot {
  day: string;
  platforms: Record<
    Platform,
    Pick<PlatformState, 'watchedVideos' | 'watchTimeMs'> & { incomplete?: boolean }
  >;
}

export interface EngineConfig {
  /** Local hour (0-23) at which a new Day starts. Default 4. */
  rolloverHour?: number;
  /** Tier thresholds. Default 10/30/60/120 for both videos and minutes. */
  thresholds?: TierThresholds;
}

export interface CountingEngineOptions extends EngineConfig {
  clock: Clock;
  /** Called once for each Day that ends, with that Day's final state. */
  onDayEnded?: (summary: DaySummary) => void;
}

export interface CountingEngine {
  /** Feed one event into the engine. Malformed or out-of-order events never throw. */
  handle(event: EngineEvent): void;
  /** Current state, including the time of videos that are still playing. */
  getState(): EngineState;
  /** Change the rollover hour or Tier thresholds. The current Day keeps its counts. */
  configure(config: EngineConfig): void;
  /**
   * Add the saved counts of a Day back in. Applies only to the engine's current Day
   * (or sets it, if no event has arrived yet), so it is safe to call late.
   */
  restore(snapshot: DaySnapshot): void;
}
