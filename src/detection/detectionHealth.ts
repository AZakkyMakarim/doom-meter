import { PLATFORMS } from '../engine';
import type { EngineEvent, Platform } from '../engine';

/**
 * Decides when video detection for a Platform has failed or recovered (ADR 0005).
 * Pure rules, no device calls and no clock: it is fed timestamped facts and returns
 * `detectionFailed` / `detectionHealthy` events for the Counting engine, which owns
 * what a failure means for the numbers.
 *
 * Two reasons a Platform counts as failed:
 * - service: the Accessibility service went away while that Platform's app was in the
 *   foreground, or the app came to the foreground while the service was gone.
 * - blind: the Platform's app stayed in the foreground for a long time while the service
 *   ran, and its adapter never recognised a surface in that stretch.
 */

/** Longest a Platform app may stay in the foreground with no surface before it counts as blind. */
export const BLIND_AFTER_MS = 30 * 60_000;

/** Facts about the Accessibility service itself. */
export type AccessibilityFact =
  | { type: 'accessibilityConnected'; at?: number }
  /** `platform` is the Platform app in the foreground when the service went away, if any. */
  | { type: 'accessibilityDisconnected'; platform?: Platform; at?: number };

type WithAt<E> = E extends unknown ? Omit<E, 'at'> & { at: number } : never;

/** Everything the monitor reads; every event must carry its timestamp. */
export type HealthInput = WithAt<EngineEvent | AccessibilityFact>;

export interface DetectionHealthMonitor {
  /** Feed one fact. Returns the engine events it caused, in order. */
  observe(event: HealthInput): EngineEvent[];
  /** Let time pass. Call every so often with the current time. */
  tick(now: number): EngineEvent[];
}

interface Reasons {
  service: boolean;
  blind: boolean;
}

export function createDetectionHealthMonitor(): DetectionHealthMonitor {
  let serviceConnected = true;
  let foreground: Platform | null = null;
  let foregroundSince = 0;
  const lastSurfaceAt = {} as Record<Platform, number | null>;
  const reasons = {} as Record<Platform, Reasons>;
  for (const p of PLATFORMS) {
    lastSurfaceAt[p] = null;
    reasons[p] = { service: false, blind: false };
  }

  const isFailed = (p: Platform) => reasons[p].service || reasons[p].blind;

  function setReason(
    platform: Platform,
    reason: keyof Reasons,
    on: boolean,
    at: number,
    out: EngineEvent[],
  ) {
    const wasFailed = isFailed(platform);
    reasons[platform][reason] = on;
    const nowFailed = isFailed(platform);
    if (!wasFailed && nowFailed) out.push({ type: 'detectionFailed', platform, at });
    if (wasFailed && !nowFailed) out.push({ type: 'detectionHealthy', platform, at });
  }

  function surfaceSeenInStint(platform: Platform): boolean {
    const seen = lastSurfaceAt[platform];
    return seen !== null && seen >= foregroundSince;
  }

  function observe(event: HealthInput): EngineEvent[] {
    const out: EngineEvent[] = [];
    const { at } = event;
    switch (event.type) {
      case 'accessibilityDisconnected': {
        serviceConnected = false;
        const affected = event.platform ?? foreground;
        if (affected !== null) setReason(affected, 'service', true, at, out);
        break;
      }
      case 'accessibilityConnected': {
        serviceConnected = true;
        for (const p of PLATFORMS) setReason(p, 'service', false, at, out);
        break;
      }
      case 'usageForegroundStarted': {
        foreground = event.platform;
        foregroundSince = at;
        if (!serviceConnected) setReason(event.platform, 'service', true, at, out);
        break;
      }
      case 'usageForegroundEnded': {
        if (foreground === event.platform) foreground = null;
        break;
      }
      case 'screenOff': {
        // Whatever was in the foreground is not being watched; the next stretch starts afresh.
        foreground = null;
        break;
      }
      case 'surfaceFocusGained': {
        // A recognised surface proves the service is alive and the adapter works.
        lastSurfaceAt[event.platform] = at;
        serviceConnected = true;
        for (const p of PLATFORMS) setReason(p, 'service', false, at, out);
        setReason(event.platform, 'blind', false, at, out);
        break;
      }
      case 'surfaceFocusLost':
      case 'videoChanged': {
        lastSurfaceAt[event.platform] = at;
        break;
      }
      default:
        break;
    }
    return out;
  }

  function tick(now: number): EngineEvent[] {
    const out: EngineEvent[] = [];
    if (
      serviceConnected &&
      foreground !== null &&
      !isFailed(foreground) &&
      !surfaceSeenInStint(foreground) &&
      now - foregroundSince >= BLIND_AFTER_MS
    ) {
      setReason(foreground, 'blind', true, now, out);
    }
    return out;
  }

  return { observe, tick };
}
