import { PLATFORMS } from '../engine';
import type { EngineEvent, Platform } from '../engine';

const PLATFORM_EVENTS = [
  'surfaceFocusGained',
  'surfaceFocusLost',
  'videoChanged',
  'detectionHealthy',
  'detectionFailed',
] as const;
const SCREEN_EVENTS = ['screenOn', 'screenOff'] as const;

type PlatformEventType = (typeof PLATFORM_EVENTS)[number];
type ScreenEventType = (typeof SCREEN_EVENTS)[number];

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
 * Turns the JSON the native detection layer emits into an engine event.
 * Only known fields are read, so nothing else the native side might send can
 * reach the engine. Returns null for anything malformed; never throws.
 */
export function parseRawEvent(json: string): EngineEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { type, platform, at } = raw as Record<string, unknown>;
  const stamp = typeof at === 'number' && Number.isFinite(at) ? { at } : {};

  if (isScreenEvent(type)) return { type, ...stamp };
  if (isPlatformEvent(type) && isPlatform(platform)) return { type, platform, ...stamp };
  return null;
}
