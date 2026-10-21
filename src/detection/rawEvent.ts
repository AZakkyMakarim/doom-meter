import { PLATFORMS } from '../engine';
import type { EngineEvent, Platform } from '../engine';
import type { AccessibilityFact } from './detectionHealth';

const PLATFORM_EVENTS = [
  'surfaceFocusGained',
  'surfaceFocusLost',
  'videoChanged',
  'detectionHealthy',
  'detectionFailed',
  'usageForegroundStarted',
  'usageForegroundEnded',
  'accessibilityActivity',
] as const;
const SCREEN_EVENTS = ['screenOn', 'screenOff'] as const;

type PlatformEventType = (typeof PLATFORM_EVENTS)[number];
type ScreenEventType = (typeof SCREEN_EVENTS)[number];

/** What the native detection layer can send: engine events and facts about the service. */
export type RawDetectionEvent = EngineEvent | AccessibilityFact;

function isPlatformEvent(type: unknown): type is PlatformEventType {
  return PLATFORM_EVENTS.includes(type as PlatformEventType);
}

function isScreenEvent(type: unknown): type is ScreenEventType {
  return SCREEN_EVENTS.includes(type as ScreenEventType);
}

function isPlatform(value: unknown): value is Platform {
  return PLATFORMS.includes(value as Platform);
}

/**
 * Turns the JSON the native detection layer emits into an event.
 * Only known fields are read, so nothing else the native side might send can
 * reach the engine. Returns null for anything malformed; never throws.
 */
export function parseRawEvent(json: string): RawDetectionEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { type, platform, at, sameVideo } = raw as Record<string, unknown>;
  const stamp = typeof at === 'number' && Number.isFinite(at) ? { at } : {};

  if (isScreenEvent(type)) return { type, ...stamp };
  if (type === 'accessibilityConnected') return { type, ...stamp };
  if (type === 'accessibilityDisconnected') {
    return isPlatform(platform) ? { type, platform, ...stamp } : { type, ...stamp };
  }
  if (type === 'surfaceFocusGained' && isPlatform(platform)) {
    return sameVideo === true ? { type, platform, sameVideo, ...stamp } : { type, platform, ...stamp };
  }
  // The cast: with four Platforms the type x platform union is too big for TS to check unaided.
  if (isPlatformEvent(type) && isPlatform(platform)) return { type, platform, ...stamp } as RawDetectionEvent;
  return null;
}
