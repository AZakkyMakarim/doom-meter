import { createCountingEngine } from '../engine';
import type { Clock, CountingEngine, EngineEvent, EngineState, Platform } from '../engine';
import { createDetectionHealthMonitor } from './detectionHealth';
import type { HealthInput } from './detectionHealth';
import type { RawDetectionEvent } from './rawEvent';
import { createPillPresenter } from '../overlay/pillViewModel';
import type { PillViewModel } from '../overlay/pillViewModel';

export interface PillSink {
  render(pill: PillViewModel): void;
  hide(): void;
}

export interface DetectionRunnerOptions {
  clock: Clock;
  pill: PillSink;
  /** How often the pill redraws while visible, so Watch time keeps moving. Default 1000. */
  tickMs?: number;
  /** Whether the user has the Overlay pill switched on. Default true. */
  pillEnabled?: boolean;
  engine?: CountingEngine;
}

export interface DetectionRunner {
  /** Feed one raw event from a detection adapter (or the debug simulator). */
  handle(event: RawDetectionEvent): void;
  /** Let time pass for the detection health rules; call every so often. */
  tick(): void;
  getState(): EngineState;
  /** The Platform whose Short-form surface is active in the foreground, if any. */
  activePlatform(): Platform | null;
  isPillShown(): boolean;
  setPillEnabled(enabled: boolean): void;
  /** Called after every event and every redraw. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Stops the redraw timer and hides the pill. */
  stop(): void;
}

const DEFAULT_TICK_MS = 1000;

/**
 * Glue between the detection adapters and the rest of the app: feeds raw events
 * into the Counting engine and drives the Overlay pill. The pill is shown only
 * while a Short-form surface is active, the screen is on, and the user has the
 * overlay switched on. It holds no counting rules; the engine owns those.
 */
export function createDetectionRunner(options: DetectionRunnerOptions): DetectionRunner {
  const { clock, pill } = options;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const engine = options.engine ?? createCountingEngine({ clock });
  const listeners = new Set<() => void>();
  const health = createDetectionHealthMonitor();

  let presenter = createPillPresenter();
  let active: Platform | null = null;
  let screenOn = true;
  let pillEnabled = options.pillEnabled ?? true;
  let shown = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function shouldShow() {
    return pillEnabled && screenOn && active !== null;
  }

  function startTimer() {
    if (timer !== null) return;
    timer = setInterval(refresh, tickMs);
  }

  function stopTimer() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  function refresh() {
    if (shouldShow()) {
      shown = true;
      startTimer();
      pill.render(presenter(engine.getState()));
    } else {
      stopTimer();
      if (shown) {
        shown = false;
        pill.hide();
        // A fresh presenter, so showing the pill again never replays a Tier change.
        presenter = createPillPresenter();
      }
    }
    listeners.forEach((listener) => listener());
  }

  return {
    tick() {
      health.tick(clock.now()).forEach((derived: EngineEvent) => engine.handle(derived));
      refresh();
    },
    handle(raw) {
      const event = { ...raw, at: raw.at ?? clock.now() } as HealthInput;
      // Facts about the Accessibility service are for the health rules only.
      if (event.type !== 'accessibilityConnected' && event.type !== 'accessibilityDisconnected') {
        engine.handle(event);
      }
      // The health rules may decide detection failed or recovered; the engine owns what that means.
      health.observe(event).forEach((derived: EngineEvent) => engine.handle(derived));
      switch (event.type) {
        case 'surfaceFocusGained':
          active = event.platform;
          break;
        case 'surfaceFocusLost':
          if (active === event.platform) active = null;
          break;
        case 'screenOn':
          screenOn = true;
          break;
        case 'screenOff':
          screenOn = false;
          break;
      }
      refresh();
    },
    getState: () => engine.getState(),
    activePlatform: () => active,
    isPillShown: () => shown,
    setPillEnabled(enabled) {
      pillEnabled = enabled;
      refresh();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      stopTimer();
      if (shown) {
        shown = false;
        pill.hide();
      }
    },
  };
}
