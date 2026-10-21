import { PLATFORMS } from '../engine';
import type { Clock, Platform, Tier } from '../engine';
import { dayEndFor } from '../engine/day';
import type { Punishment, PunishmentRules, SettingsPatch } from '../settings/settings';
import { DEFAULT_SETTINGS } from '../settings/settings';
import type { KeyValueStore } from '../storage';

export const LOCKOUT_KEY = 'doommeter:lockout';

const MS_PER_MINUTE = 60_000;
const DURATION_MS: Record<Exclude<Punishment, 'off' | 'untilDay'>, number> = {
  '15m': 15 * MS_PER_MINUTE,
  '1h': 60 * MS_PER_MINUTE,
  '3h': 180 * MS_PER_MINUTE,
};

export type LockoutStatus =
  | { active: false }
  | {
      active: true;
      /** The Tier whose Punishment set the end time. */
      tier: Tier;
      /** Epoch ms at which the Lockout ends. */
      endsAt: number;
      /** The Platforms whose apps are blocked: all of them, Lite apps included. */
      platforms: readonly Platform[];
    };

/** A settings change the Lockout refuses, with when it ends so the toast can say so. */
export interface Refusal {
  endsAt: number;
}

export interface LockoutRules {
  punishments: PunishmentRules;
  rolloverHour: number;
}

export interface LockoutEngineOptions {
  clock: Clock;
  store: KeyValueStore;
}

export interface LockoutEngine {
  /** The Punishments and rollover hour in force; call at startup and on every settings change. */
  setRules(rules: LockoutRules): void;
  /**
   * The Tier of `day` as it is now. A Lockout starts the first time a Tier above 0 is reached
   * in a Day and its Punishment is on; a longer one replaces a running Lockout. Safe to call
   * on every change and before `load` (it is applied once the saved state is read). When nothing
   * was saved (first launch after an upgrade, or a corrupt save) the first Tier seen only seeds
   * what the Day had already reached and is not punished.
   */
  observeTier(day: string, tier: Tier): void;
  /** Reads the saved state. Call once at startup. */
  load(): Promise<void>;
  /** Whether a Lockout runs now, until when, and which Platforms are blocked. */
  status(): LockoutStatus;
  /**
   * Null when the change may go ahead; while a Lockout runs, weakening settings are refused. Before
   * `load` has read the saved Lockout the answer is not known, so a protected change gets a promise
   * that settles once it is.
   */
  refusal(patch: SettingsPatch): Refusal | null | Promise<Refusal | null>;
  /** Called when a Lockout starts or is replaced. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Resolves when every save started so far has finished. */
  settled(): Promise<void>;
}

interface Saved {
  lockout: { endsAt: number; tier: Tier } | null;
  /** The highest Tier already reached in `day`, whether or not it was punished. */
  reached: { day: string; tier: Tier } | null;
}

const isTier = (v: unknown): v is Tier => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4;

/** Whatever was saved, field by field; anything unreadable counts as nothing saved. */
function sanitize(raw: unknown): Saved {
  const saved: Saved = { lockout: null, reached: null };
  if (typeof raw !== 'object' || raw === null) return saved;
  const { lockout, reached } = raw as Record<string, Record<string, unknown> | null>;
  if (lockout && typeof lockout.endsAt === 'number' && Number.isFinite(lockout.endsAt) && isTier(lockout.tier)) {
    saved.lockout = { endsAt: lockout.endsAt, tier: lockout.tier };
  }
  if (reached && typeof reached.day === 'string' && isTier(reached.tier)) {
    saved.reached = { day: reached.day, tier: reached.tier };
  }
  return saved;
}

/** Settings that would weaken a Lockout: the Punishments, the Tier thresholds and the rollover hour. */
const LOCKED_KEYS = ['punishments', 'thresholds', 'rolloverHour'] as const;

/**
 * Decides when a Lockout starts, whether it is running and which settings it freezes (ADR 0007).
 * Pure apart from the saved end time: Tier changes, settings and the Clock come in; the status
 * and the refusals come out. It does not block anything itself; the block screen asks `status`.
 */
export function createLockoutEngine(options: LockoutEngineOptions): LockoutEngine {
  const { clock, store } = options;
  const listeners = new Set<() => void>();
  let rules: LockoutRules = {
    punishments: DEFAULT_SETTINGS.punishments,
    rolloverHour: DEFAULT_SETTINGS.rolloverHour,
  };
  let saved: Saved = { lockout: null, reached: null };
  let loaded = false;
  let markLoaded: () => void = () => undefined;
  const whenLoaded = new Promise<void>((resolve) => {
    markLoaded = resolve;
  });
  /** True until the first Tier is seen with no saved `reached`: that Tier is not new. */
  let seeding = false;
  let early: [string, Tier][] = [];
  let writes: Promise<void> = Promise.resolve();

  function save() {
    const json = JSON.stringify(saved);
    // shortcut: a failed save is dropped, so a Lockout may be lost on restart; upgrade if that shows up.
    writes = writes.then(() => store.set(LOCKOUT_KEY, json)).catch(() => undefined);
  }

  function endFor(punishment: Punishment, day: string): number | null {
    if (punishment === 'off') return null;
    return punishment === 'untilDay' ? dayEndFor(day, rules.rolloverHour) : clock.now() + DURATION_MS[punishment];
  }

  function apply(day: string, tier: Tier) {
    if (seeding) {
      seeding = false;
      saved = { ...saved, reached: { day, tier } };
      save();
      return;
    }
    const from = saved.reached?.day === day ? saved.reached.tier : 0;
    if (tier <= from) return;
    saved = { ...saved, reached: { day, tier } };
    // A jump over a Tier still reaches it: the longest Punishment among the new Tiers wins.
    let best: { endsAt: number; tier: Tier } | null = null;
    for (let reachedTier = from + 1; reachedTier <= tier; reachedTier += 1) {
      const endsAt = endFor(rules.punishments[reachedTier - 1], day);
      if (endsAt !== null && (best === null || endsAt > best.endsAt)) best = { endsAt, tier: reachedTier as Tier };
    }
    const running = status();
    if (best !== null && (!running.active || best.endsAt > running.endsAt)) {
      saved = { ...saved, lockout: best };
      listeners.forEach((listener) => listener());
    }
    save();
  }

  function status(): LockoutStatus {
    const lockout = saved.lockout;
    if (lockout === null || clock.now() >= lockout.endsAt) return { active: false };
    return { active: true, tier: lockout.tier, endsAt: lockout.endsAt, platforms: PLATFORMS };
  }

  return {
    setRules(next) {
      rules = next;
    },

    observeTier(day, tier) {
      if (loaded) apply(day, tier);
      else early.push([day, tier]);
    },

    async load() {
      try {
        const raw = await store.get(LOCKOUT_KEY);
        saved = raw === null ? saved : sanitize(JSON.parse(raw));
      } catch {
        // Unreadable or corrupt: start with no Lockout.
      }
      loaded = true;
      seeding = saved.reached === null;
      markLoaded();
      const pending = early;
      early = [];
      pending.forEach(([day, tier]) => apply(day, tier));
      listeners.forEach((listener) => listener());
    },

    status,

    refusal(patch) {
      if (!LOCKED_KEYS.some((key) => patch[key] !== undefined)) return null;
      const decide = (): Refusal | null => {
        const running = status();
        return running.active ? { endsAt: running.endsAt } : null;
      };
      return loaded ? decide() : whenLoaded.then(decide);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    settled: () => writes,
  };
}
