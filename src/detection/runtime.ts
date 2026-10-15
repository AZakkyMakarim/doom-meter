import { DeviceEventEmitter } from 'react-native';
import { overlay } from '../overlay/overlayBridge';
import { createSkewClock } from '../overlay/simulator';
import { detectionNative, RAW_EVENT_NAME } from './detectionBridge';
import { createDetectionRunner } from './detectionRunner';
import type { DetectionRunner } from './detectionRunner';
import { parseRawEvent } from './rawEvent';

/**
 * The app-wide detection runtime: one Counting engine and one Overlay pill,
 * fed by the native AccessibilityService. Started from index.js at module
 * scope so it also runs when the service wakes the app with no screen open.
 */
export const debugClock = createSkewClock();

let runner: DetectionRunner | null = null;

export function getDetectionRunner(): DetectionRunner {
  runner ??= createDetectionRunner({ clock: debugClock, pill: overlay });
  return runner;
}

let started = false;

export function startDetection(): void {
  if (started) return;
  started = true;
  const active = getDetectionRunner();
  DeviceEventEmitter.addListener(RAW_EVENT_NAME, (json: unknown) => {
    if (typeof json !== 'string') return;
    const event = parseRawEvent(json);
    if (event) active.handle(event);
  });
  detectionNative.ready();
}
