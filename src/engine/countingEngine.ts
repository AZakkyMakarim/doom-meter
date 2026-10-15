import {
  PLATFORMS,
  type CountingEngine,
  type CountingEngineOptions,
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

  function handle(event: EngineEvent) {
    const requested = event.at ?? clock.now();
    const at = Math.max(requested, lastAt);
    lastAt = at;

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

  function getState(): EngineState {
    const now = Math.max(clock.now(), lastAt);
    const state = {
      platforms: {} as Record<Platform, PlatformState>,
      totals: { watchedVideos: 0, watchTimeMs: 0 },
    };
    for (const platform of PLATFORMS) {
      const snap = snapshot(platforms[platform], now);
      state.platforms[platform] = snap;
      state.totals.watchedVideos += snap.watchedVideos;
      state.totals.watchTimeMs += snap.watchTimeMs;
    }
    return state;
  }

  return { handle, getState };
}
