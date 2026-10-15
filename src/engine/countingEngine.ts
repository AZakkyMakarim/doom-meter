import {
  DEFAULT_ROLLOVER_HOUR,
  assertRolloverHour,
  dayEndFor,
  dayWindowAt,
  type DayWindow,
} from './day';
import { DEFAULT_TIER_THRESHOLDS, computeTier } from './tier';
import {
  PLATFORMS,
  type CountingEngine,
  type CountingEngineOptions,
  type EngineConfig,
  type EngineEvent,
  type EngineState,
  type Platform,
  type PlatformState,
} from './types';

export const DEFAULT_WATCHED_THRESHOLD_MS = 5000;

interface PlatformInternal {
  watchedVideos: number;
  watchTimeMs: number;
  detectionHealthy: boolean;
  /** The feed is visible and focused (regardless of screen state). */
  surfaceActive: boolean;
  /** Start of the current uninterrupted stretch of one video, or null when not accruing. */
  segmentStart: number | null;
}

function createPlatform(): PlatformInternal {
  return {
    watchedVideos: 0,
    watchTimeMs: 0,
    detectionHealthy: true,
    surfaceActive: false,
    segmentStart: null,
  };
}

export function createCountingEngine(options: CountingEngineOptions): CountingEngine {
  const { clock } = options;
  const threshold = options.watchedThresholdMs ?? DEFAULT_WATCHED_THRESHOLD_MS;
  let rolloverHour = options.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
  assertRolloverHour(rolloverHour);
  let thresholds = options.thresholds ?? DEFAULT_TIER_THRESHOLDS;
  // The current Day. Set from the first event so a clock far from the events cannot pick it.
  let window: DayWindow | null = null;

  const platforms = {} as Record<Platform, PlatformInternal>;
  for (const p of PLATFORMS) {
    platforms[p] = createPlatform();
  }
  let screenOn = true;
  // Latest timestamp seen. Late events are clamped to it so time never runs backwards.
  let lastAt = Number.NEGATIVE_INFINITY;

  function startSegment(p: PlatformInternal, at: number) {
    p.segmentStart = at;
  }

  function endSegment(p: PlatformInternal, at: number) {
    if (p.segmentStart === null) return;
    const elapsed = Math.max(0, at - p.segmentStart);
    p.watchTimeMs += elapsed;
    if (elapsed >= threshold) p.watchedVideos += 1;
    p.segmentStart = null;
  }

  function gain(platform: Platform, at: number) {
    // Only one Platform can be in the foreground; end any other active surface.
    for (const other of PLATFORMS) {
      if (other !== platform && platforms[other].surfaceActive) {
        lose(other, at);
      }
    }
    const p = platforms[platform];
    if (p.surfaceActive) return;
    p.surfaceActive = true;
    if (screenOn) startSegment(p, at);
  }

  function lose(platform: Platform, at: number) {
    const p = platforms[platform];
    if (!p.surfaceActive) return;
    endSegment(p, at);
    p.surfaceActive = false;
  }

  function changeVideo(platform: Platform, at: number) {
    const p = platforms[platform];
    if (p.segmentStart === null) return;
    endSegment(p, at);
    startSegment(p, at);
  }

  function setScreen(on: boolean, at: number) {
    if (screenOn === on) return;
    screenOn = on;
    for (const platform of PLATFORMS) {
      const p = platforms[platform];
      if (!p.surfaceActive) continue;
      if (on) startSegment(p, at);
      else endSegment(p, at);
    }
  }

  function hasRunningSegment() {
    return PLATFORMS.some((platform) => platforms[platform].segmentStart !== null);
  }

  /** Close the current Day at `boundary`; videos in progress restart in the next Day. */
  function endDay(current: DayWindow, boundary: number) {
    for (const platform of PLATFORMS) {
      endSegment(platforms[platform], boundary);
    }
    options.onDayEnded?.({ day: current.key, state: buildState(boundary, current.key) });
    for (const platform of PLATFORMS) {
      const p = platforms[platform];
      p.watchedVideos = 0;
      p.watchTimeMs = 0;
      if (p.surfaceActive && screenOn) startSegment(p, boundary);
    }
    lastAt = Math.max(lastAt, boundary);
  }

  /** Roll the Day over for every boundary up to and including `t`. */
  function advanceDays(t: number) {
    if (window === null) return;
    while (t >= window.end) {
      const boundary = window.end;
      endDay(window, boundary);
      // After a long quiet gap there is nothing to split; jump straight to `t`.
      window = dayWindowAt(hasRunningSegment() ? boundary : t, rolloverHour);
    }
  }

  function configure(config: EngineConfig) {
    if (config.rolloverHour !== undefined) {
      assertRolloverHour(config.rolloverHour);
      rolloverHour = config.rolloverHour;
      // The current Day keeps its label and counts; only its end moves.
      if (window !== null) {
        window = { key: window.key, end: dayEndFor(window.key, rolloverHour) };
      }
    }
    if (config.thresholds !== undefined) thresholds = config.thresholds;
  }

  function handle(event: EngineEvent) {
    const requested = event.at ?? clock.now();
    const at = Math.max(requested, lastAt);
    lastAt = at;
    window ??= dayWindowAt(at, rolloverHour);
    advanceDays(at);

    switch (event.type) {
      case 'surfaceFocusGained':
        gain(event.platform, at);
        break;
      case 'surfaceFocusLost':
        lose(event.platform, at);
        break;
      case 'videoChanged':
        changeVideo(event.platform, at);
        break;
      case 'screenOn':
        setScreen(true, at);
        break;
      case 'screenOff':
        setScreen(false, at);
        break;
      case 'detectionHealthy':
        platforms[event.platform].detectionHealthy = true;
        break;
      case 'detectionFailed':
        platforms[event.platform].detectionHealthy = false;
        break;
    }
  }

  function snapshot(p: PlatformInternal, now: number): PlatformState {
    let watchedVideos = p.watchedVideos;
    let watchTimeMs = p.watchTimeMs;
    if (p.segmentStart !== null) {
      const elapsed = Math.max(0, now - p.segmentStart);
      watchTimeMs += elapsed;
      if (elapsed >= threshold) watchedVideos += 1;
    }
    return { watchedVideos, watchTimeMs, detectionHealthy: p.detectionHealthy };
  }

  function buildState(now: number, day: string): EngineState {
    const platformStates = {} as Record<Platform, PlatformState>;
    const totals = { watchedVideos: 0, watchTimeMs: 0 };
    for (const platform of PLATFORMS) {
      const snap = snapshot(platforms[platform], now);
      platformStates[platform] = snap;
      totals.watchedVideos += snap.watchedVideos;
      totals.watchTimeMs += snap.watchTimeMs;
    }
    return { day, platforms: platformStates, totals, tier: computeTier(totals, thresholds) };
  }

  function getState(): EngineState {
    const now = Math.max(clock.now(), lastAt);
    advanceDays(now);
    const day = window?.key ?? dayWindowAt(now, rolloverHour).key;
    return buildState(now, day);
  }

  return { handle, getState, configure };
}
