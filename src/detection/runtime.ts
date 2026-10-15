import { AccessibilityInfo, AppState, DeviceEventEmitter } from 'react-native';
import { createCountingEngine } from '../engine';
import { overlay } from '../overlay/overlayBridge';
import { setPillPreferences } from '../overlay/pillViewModel';
import { watchReducedMotion } from '../overlay/reducedMotion';
import { createSkewClock } from '../overlay/simulator';
import { applySettings } from '../settings/applySettings';
import { settingsStore } from '../settings/deviceSettings';
import { positionFromDrag } from '../settings/settings';
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

/** How often foreground changes are read from UsageStats and the health rules are ticked. */
const USAGE_POLL_MS = 5000;

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
  // Settings reach the engine, the pill and the recorder at startup and on every change.
  settingsStore.subscribe((settings) =>
    applySettings(settings, {
      engine,
      runner: active,
      setPillPreferences,
      setRecorderRolloverHour: recorder.setRolloverHour,
    }),
  );
  // "Remove animations" turns the pill's pulse, number roll and scale pop off (MASTER 7).
  // The pill redraws every second, so the change shows up on the next tick.
  watchReducedMotion(
    {
      isEnabled: () => AccessibilityInfo.isReduceMotionEnabled(),
      subscribe: (listener) => {
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', listener);
        return () => sub.remove();
      },
    },
    (reducedMotion) => setPillPreferences({ reducedMotion }),
  );
  // Dragging the pill saves its new position, so the Settings control stays in step.
  overlay.onMoved((dp) => {
    settingsStore.update({ positionDp: positionFromDrag(dp) });
  });
  // The saved rollover hour must be in force before the current Day is looked up.
  // Events that arrive before the saved counts are loaded are added on top of them.
  restored = settingsStore
    .load()
    .catch(() => undefined)
    .then(() => recorder.restoreInto(engine, debugClock.now()))
    .catch(() => undefined);
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
  // UsageStats events and the detection health rules both move with time, so poll them together.
  setInterval(() => {
    detectionNative
      .pollUsageEvents()
      .then((events) => {
        for (const json of events) {
          const event = parseRawEvent(json);
          if (event) active.handle(event);
        }
        active.tick();
      })
      .catch(() => active.tick());
  }, USAGE_POLL_MS);
}
