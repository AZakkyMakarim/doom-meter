import { AccessibilityInfo, AppState, DeviceEventEmitter } from 'react-native';
import { createCountingEngine } from '../engine';
import { deviceLocaleTag } from '../i18n/deviceLocale';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translate';
import { lockoutNative } from '../lockout/lockoutBridge';
import { createLockoutEngine } from '../lockout/lockoutEngine';
import { lockoutViewModelFor } from '../lockout/lockoutViewModel';
import { overlay } from '../overlay/overlayBridge';
import { setPillPreferences } from '../overlay/pillViewModel';
import { watchReducedMotion } from '../overlay/reducedMotion';
import { createSkewClock } from '../overlay/simulator';
import { applySettings } from '../settings/applySettings';
import { settingsStore } from '../settings/deviceSettings';
import { positionFromDrag } from '../settings/settings';
import { createDayRecorder } from '../storage';
import { createAsyncStorageKeyValueStore } from '../storage/asyncStorageKeyValueStore';
import { dayStore } from '../storage/deviceDayStore';
import { widgetNative } from '../widget/widgetBridge';
import { createWidgetSync } from '../widget/widgetSync';
import { widgetViewModelFor } from '../widget/widgetViewModel';
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

/**
 * The Lockout engine: starts a Lockout when a Punished Tier is reached and keeps its end time on the
 * device. The block screen and the settings lock ask it; it never blocks anything itself.
 */
export const lockoutEngine = createLockoutEngine({ clock: debugClock, store: createAsyncStorageKeyValueStore() });

// While a Lockout runs, Punishment, thresholds and rollover hour cannot change (ADR 0007).
settingsStore.setRefusal(lockoutEngine.refusal);

let runner: DetectionRunner | null = null;

// The Home widget keeps its own copy of today's numbers on the device (see widgetSync).
const widgetSync = createWidgetSync({ sink: widgetNative });
let widgetLocale: Locale = DEFAULT_LOCALE;
// Held back until the saved counts are restored, so an empty engine never blanks the widget.
let widgetReady = false;

// The block screen reads its own device copy of the Lockout (see lockoutViewModel). Held back until
// the saved Lockout is read, so an empty engine never wipes the copy and unblocks a running Lockout.
let lockoutReady = false;

function syncLockout(): void {
  if (!lockoutReady) return;
  lockoutNative.update(JSON.stringify(lockoutViewModelFor(lockoutEngine.status(), widgetLocale)));
}

function syncWidget(): void {
  if (!widgetReady) return;
  widgetSync.update(
    widgetViewModelFor(getDetectionRunner().getState(), {
      rolloverHour: settingsStore.get().rolloverHour,
      locale: widgetLocale,
    }),
  );
}

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

/** Resolves when every Day write started so far has finished, such as the Day that just ended. */
export function whenDaysSaved(): Promise<void> {
  return recorder.settled();
}

export function startDetection(): void {
  if (started) return;
  started = true;
  const active = getDetectionRunner();
  // Settings reach the engine, the pill and the recorder at startup and on every change.
  const applyCurrent = () =>
    applySettings(settingsStore.get(), {
      engine,
      runner: active,
      setPillPreferences,
      setRecorderRolloverHour: recorder.setRolloverHour,
      lockout: lockoutEngine,
      deviceLocale: deviceLocaleTag,
      // Native owns the notification text; the pill's texts travel inside the pill itself.
      setLocale: (locale) => {
        detectionNative.setNotificationText(t(locale, 'notification.text'));
        widgetLocale = locale;
        syncWidget();
        syncLockout();
      },
    });
  settingsStore.subscribe(applyCurrent);
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
  active.subscribe(() => recorder.observe(active.getState(), active.activePlatform() === null));
  AppState.addEventListener('change', (next) => {
    if (next !== 'active') recorder.flush();
    // The device language may have changed while the app was away; System follows it.
    else applyCurrent();
  });
  // The saved rollover hour must be in force before any event is counted or the current Day
  // is looked up, so detection is only switched on after settings and saved counts are back.
  // Native buffers raw events until `ready()`, so nothing is lost while this runs.
  restored = settingsStore
    .load()
    .catch(() => undefined)
    .then(() => lockoutEngine.load())
    .then(() => {
      lockoutReady = true;
      lockoutEngine.subscribe(syncLockout);
      syncLockout();
    })
    .then(() => recorder.restoreInto(engine, debugClock.now()))
    .catch(() => undefined);
  restored.then(() => {
    widgetReady = true;
    active.subscribe(syncWidget);
    syncWidget();
    // Only now: the restored counts must not look like a Tier that was just reached.
    const observeTier = () => {
      const { day, tier } = active.getState();
      lockoutEngine.observeTier(day, tier);
    };
    active.subscribe(observeTier);
    observeTier();
  });
  restored.then(startFeeds);
}

/** Starts feeding native events and UsageStats polls into the engine. */
function startFeeds(): void {
  const active = getDetectionRunner();
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
