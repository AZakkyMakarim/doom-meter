import { AppState, DeviceEventEmitter } from 'react-native';
import { createCountingEngine } from '../engine';
import { overlay } from '../overlay/overlayBridge';
import { createSkewClock } from '../overlay/simulator';
import { createDayRecorder } from '../storage';
import { dayStore } from '../storage/deviceDayStore';
import { detectionNative, RAW_EVENT_NAME } from './detectionBridge';
import { createDetectionRunner } from './detectionRunner';
import type { DetectionRunner } from './detectionRunner';
import { parseRawEvent } from './rawEvent';

/**
 * The app-wide detection runtime: one Counting engine and one Overlay pill,
 * fed by the native AccessibilityService. Started from index.js at module
 * scope so it also runs when the service wakes the app with no screen open.
 *
 * The engine's Day counts are saved locally as they grow and restored on start,
 * so they survive the process being killed.
 */
export const debugClock = createSkewClock();

const recorder = createDayRecorder({ store: dayStore });
const engine = createCountingEngine({ clock: debugClock, onDayEnded: recorder.onDayEnded });

let runner: DetectionRunner | null = null;

export function getDetectionRunner(): DetectionRunner {
  runner ??= createDetectionRunner({ clock: debugClock, pill: overlay, engine });
  return runner;
}

let started = false;
let restored: Promise<void> = Promise.resolve();

/** Resolves once the saved counts of the current Day are back in the engine. */
export function whenRestored(): Promise<void> {
  return restored;
}

export function startDetection(): void {
  if (started) return;
  started = true;
  const active = getDetectionRunner();
  // Events that arrive before the saved counts are loaded are added on top of them.
  restored = recorder.restoreInto(engine, debugClock.now()).catch(() => undefined);
  active.subscribe(() => recorder.observe(active.getState(), active.activePlatform() === null));
  AppState.addEventListener('change', (next) => {
    if (next !== 'active') recorder.flush();
  });
  DeviceEventEmitter.addListener(RAW_EVENT_NAME, (json: unknown) => {
    if (typeof json !== 'string') return;
    const event = parseRawEvent(json);
    if (event) active.handle(event);
  });
  detectionNative.ready();
}
