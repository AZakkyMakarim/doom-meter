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
 * - silent: UsageStats says the Platform's app is in the foreground, the service is meant
 *   to be running, and not a single accessibility event has come from that app for a
 *   while. Not seeing a Short-form surface is never a failure: long videos, the home feed
 *   and DMs are ordinary use.
 */

/** How long a Platform app may be in the foreground with no accessibility activity at all. */
export const SILENT_AFTER_MS = 10 * 60_000;

/** Facts about the Accessibility service itself. */
export type AccessibilityFact =
  | { type: 'accessibilityConnected'; at?: number }
  /** `platform` is the Platform app in the foreground when the service went away, if any. */
  | { type: 'accessibilityDisconnected'; platform?: Platform; at?: number }
  /** The service received accessibility events from this Platform's app (whatever they were). */
  | { type: 'accessibilityActivity'; platform: Platform; at?: number };

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
  silent: boolean;
}

export function createDetectionHealthMonitor(): DetectionHealthMonitor {
  let serviceConnected = true;
  let foreground: Platform | null = null;
  let foregroundSince = 0;
  /** The Platform that was in the foreground when the screen went off, to restore on screenOn. */
  let foregroundBeforeScreenOff: Platform | null = null;
  /** When the service last (re)connected; the silence is measured from there at the earliest. */
  let connectedAt = Number.NEGATIVE_INFINITY;
  const lastActivityAt = {} as Record<Platform, number | null>;
  const reasons = {} as Record<Platform, Reasons>;
  for (const p of PLATFORMS) {
    lastActivityAt[p] = null;
    reasons[p] = { service: false, silent: false };
  }

  const isFailed = (p: Platform) => reasons[p].service || reasons[p].silent;

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

  /** The moment the current stretch of silence from `platform` began. */
  function quietSince(platform: Platform): number {
    return Math.max(foregroundSince, connectedAt, lastActivityAt[platform] ?? Number.NEGATIVE_INFINITY);
  }

  function noteActivity(platform: Platform, at: number) {
    const last = lastActivityAt[platform];
    if (last === null || at > last) lastActivityAt[platform] = at;
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
        connectedAt = at;
        for (const p of PLATFORMS) setReason(p, 'service', false, at, out);
        break;
      }
      case 'usageForegroundStarted': {
        foreground = event.platform;
        foregroundSince = at;
        foregroundBeforeScreenOff = null;
        if (!serviceConnected) setReason(event.platform, 'service', true, at, out);
        break;
      }
      case 'usageForegroundEnded': {
        if (foreground === event.platform) foreground = null;
        if (foregroundBeforeScreenOff === event.platform) foregroundBeforeScreenOff = null;
        break;
      }
      case 'screenOff': {
        // Whatever was in the foreground is not being watched; remember it for the unlock.
        if (foreground !== null) foregroundBeforeScreenOff = foreground;
        foreground = null;
        break;
      }
      case 'screenOn': {
        // The same app is normally still there when the screen comes back; a fresh stretch
        // starts, and the next UsageStats poll corrects it if the user is elsewhere.
        if (foreground === null && foregroundBeforeScreenOff !== null) {
          foreground = foregroundBeforeScreenOff;
          foregroundSince = at;
        }
        foregroundBeforeScreenOff = null;
        break;
      }
      case 'accessibilityActivity': {
        noteActivity(event.platform, at);
        setReason(event.platform, 'silent', false, at, out);
        break;
      }
      case 'surfaceFocusGained': {
        // A recognised surface proves the service is alive and the adapter works.
        noteActivity(event.platform, at);
        serviceConnected = true;
        for (const p of PLATFORMS) setReason(p, 'service', false, at, out);
        setReason(event.platform, 'silent', false, at, out);
        break;
      }
      case 'surfaceFocusLost':
      case 'videoChanged': {
        // Activity, but a loss is what the dying service itself emits, so unlike a gain it
        // proves nothing about the service being alive (the service reason is left alone).
        noteActivity(event.platform, at);
        setReason(event.platform, 'silent', false, at, out);
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
      now - quietSince(foreground) >= SILENT_AFTER_MS
    ) {
      setReason(foreground, 'silent', true, now, out);
    }
    return out;
  }

  return { observe, tick };
}
