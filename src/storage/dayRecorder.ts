import { DEFAULT_ROLLOVER_HOUR, PLATFORMS } from '../engine';
import type { CountingEngine, DaySummary, EngineState, Platform } from '../engine';
import { dayWindowAt } from '../engine/day';
import { emptyDayRecord } from './dayStore';
import type { DayRecord, DayStore } from './dayStore';

export interface DayRecorderOptions {
  store: DayStore;
  /** Wall-clock time in ms, used only to throttle writes. Default Date.now. */
  now?: () => number;
  /** Longest time the stored Day may lag behind while the user keeps scrolling. Default 10s. */
  flushIntervalMs?: number;
  /** Rollover hour used to find the current Day on startup. Default 4. */
  rolloverHour?: number;
}

export interface DayRecorder {
  /**
   * Load the stored counts of the current Day and hand them to the engine, so
   * the numbers survive a process restart. Call once at startup.
   */
  restoreInto(engine: CountingEngine, nowMs: number): Promise<void>;
  /**
   * Report the engine state after every event or redraw. Writes to storage when the
   * counts changed and the last write is older than the flush interval, or when
   * scrolling has stopped (`idle`), so an app kill loses at most a few seconds.
   */
  observe(state: EngineState, idle: boolean): void;
  /** Write the latest observed state now (app going to the background). */
  flush(): Promise<void>;
  /** Pass as the engine's `onDayEnded`: saves the Day that just ended. */
  onDayEnded(summary: DaySummary): void;
  /** Resolves when every write started so far has finished. */
  settled(): Promise<void>;
}

function signature(record: DayRecord): string {
  return PLATFORMS.map((p) => {
    const r = record.platforms[p];
    return `${r.watchedVideos}/${Math.floor(r.watchTimeMs)}/${r.incomplete ? 1 : 0}`;
  }).join('|');
}

/**
 * Keeps one stored record per Day in step with the Counting engine. It owns the
 * "incomplete" flag: sticky for the Day once detection fails for a Platform.
 */
export function createDayRecorder(options: DayRecorderOptions): DayRecorder {
  const { store } = options;
  const now = options.now ?? Date.now;
  const flushIntervalMs = options.flushIntervalMs ?? 10_000;
  const rolloverHour = options.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;

  let incompleteDay: string | null = null;
  const incomplete = {} as Record<Platform, boolean>;
  for (const p of PLATFORMS) incomplete[p] = false;

  let latest: EngineState | null = null;
  let lastQueuedSignature: string | null = null;
  let lastFlushAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<unknown> = Promise.resolve();

  function trackIncomplete(state: EngineState) {
    if (incompleteDay !== state.day) {
      incompleteDay = state.day;
      for (const p of PLATFORMS) incomplete[p] = false;
    }
    for (const p of PLATFORMS) {
      if (!state.platforms[p].detectionHealthy) incomplete[p] = true;
    }
  }

  function recordFor(state: EngineState): DayRecord {
    trackIncomplete(state);
    const record = emptyDayRecord(state.day);
    for (const p of PLATFORMS) {
      record.platforms[p] = {
        watchedVideos: state.platforms[p].watchedVideos,
        watchTimeMs: state.platforms[p].watchTimeMs,
        incomplete: incomplete[p],
      };
    }
    return record;
  }

  function write(record: DayRecord, onFailure?: () => void) {
    const run = store.saveDay(record).catch(() => onFailure?.());
    pending = pending.then(() => run);
    return run;
  }

  function writeLatest() {
    if (latest === null) return Promise.resolve();
    const record = recordFor(latest);
    const sig = signature(record);
    if (sig === lastQueuedSignature) return Promise.resolve();
    lastQueuedSignature = sig;
    lastFlushAt = now();
    // A failed write is forgotten, so the next observation tries again.
    return write(record, () => {
      if (lastQueuedSignature === sig) lastQueuedSignature = null;
    });
  }

  function settled() {
    return pending.then(
      () => undefined,
      () => undefined,
    );
  }

  return {
    async restoreInto(engine, nowMs) {
      const day = dayWindowAt(nowMs, rolloverHour).key;
      let record: DayRecord | null = null;
      try {
        record = await store.getDay(day);
      } catch {
        return;
      }
      if (record === null) return;
      incompleteDay = day;
      for (const p of PLATFORMS) incomplete[p] = record.platforms[p].incomplete;
      engine.restore({ day, platforms: record.platforms });
    },

    observe(state, idle) {
      latest = state;
      const record = recordFor(state);
      if (signature(record) === lastQueuedSignature) return;
      if (idle || now() - lastFlushAt >= flushIntervalMs) writeLatest();
    },

    flush() {
      writeLatest();
      return settled();
    },

    onDayEnded(summary) {
      // The engine reports the finished Day, so it is written whatever the throttle says.
      trackIncomplete(summary.state);
      const record = recordFor(summary.state);
      incompleteDay = null;
      write(record);
    },

    settled,
  };
}
