import { PLATFORMS } from '../engine';
import type { Platform } from '../engine';
import type { KeyValueStore } from './keyValueStore';

/** What is kept for one Platform on one Day. Aggregates only: no titles, no content. */
export interface PlatformDayRecord {
  watchedVideos: number;
  watchTimeMs: number;
  /** Detection for this Platform stopped responding at some point in the Day, so counts may be low. */
  incomplete: boolean;
}

/** One Day: a record per Platform. `day` is the YYYY-MM-DD label the engine uses. */
export interface DayRecord {
  day: string;
  platforms: Record<Platform, PlatformDayRecord>;
}

/**
 * Local storage of Day records. History, Settings and the Today screen all read
 * through this interface; tests use it over the in-memory key-value fake.
 */
export interface DayStore {
  /**
   * Insert or update a Day. Counts only grow within a Day (there is no reset), so
   * this keeps the larger value per Platform and never lowers a count; the
   * incomplete flag, once set, stays set. A stale or late write is therefore harmless.
   */
  saveDay(record: DayRecord): Promise<void>;
  getDay(day: string): Promise<DayRecord | null>;
  /** Stored Day labels, newest first. */
  listDayKeys(): Promise<string[]>;
  /** Stored Days, newest first, at most `limit` of them. */
  listDays(limit?: number): Promise<DayRecord[]>;
}

const KEY_PREFIX = 'doommeter:v1:day:';
const DAY_LABEL = /^\d{4}-\d{2}-\d{2}$/;

export function emptyDayRecord(day: string): DayRecord {
  const platforms = {} as Record<Platform, PlatformDayRecord>;
  for (const platform of PLATFORMS) {
    platforms[platform] = { watchedVideos: 0, watchTimeMs: 0, incomplete: false };
  }
  return { day, platforms };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function time(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function parseRecord(day: string, raw: string | null): DayRecord | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const stored = (parsed as { platforms?: unknown }).platforms;
  const source = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const record = emptyDayRecord(day);
  for (const platform of PLATFORMS) {
    const p = source[platform];
    if (typeof p !== 'object' || p === null) continue;
    const fields = p as Record<string, unknown>;
    record.platforms[platform] = {
      watchedVideos: count(fields.watchedVideos),
      watchTimeMs: time(fields.watchTimeMs),
      incomplete: fields.incomplete === true,
    };
  }
  return record;
}

function merge(existing: DayRecord | null, incoming: DayRecord): DayRecord {
  const merged = emptyDayRecord(incoming.day);
  for (const platform of PLATFORMS) {
    const a = existing?.platforms[platform];
    const b = incoming.platforms[platform];
    merged.platforms[platform] = {
      watchedVideos: Math.max(a?.watchedVideos ?? 0, count(b.watchedVideos)),
      watchTimeMs: Math.max(a?.watchTimeMs ?? 0, time(b.watchTimeMs)),
      incomplete: (a?.incomplete ?? false) || b.incomplete === true,
    };
  }
  return merged;
}

export function createDayStore(kv: KeyValueStore): DayStore {
  // Saves run one at a time, so the read-merge-write of two saves never interleaves.
  let queue: Promise<unknown> = Promise.resolve();

  function keyFor(day: string) {
    return `${KEY_PREFIX}${day}`;
  }

  async function getDay(day: string) {
    return parseRecord(day, await kv.get(keyFor(day)));
  }

  function saveDay(record: DayRecord) {
    const task = async () => {
      const merged = merge(await getDay(record.day), record);
      await kv.set(keyFor(record.day), JSON.stringify(merged));
    };
    // A failed save must not block the saves after it.
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  async function listDayKeys() {
    const keys = await kv.keys();
    return keys
      .filter((key) => key.startsWith(KEY_PREFIX))
      .map((key) => key.slice(KEY_PREFIX.length))
      .filter((day) => DAY_LABEL.test(day))
      .sort()
      .reverse();
  }

  async function listDays(limit?: number) {
    const days = await listDayKeys();
    const wanted = limit === undefined ? days : days.slice(0, Math.max(0, limit));
    const raws = await kv.getMany(wanted.map(keyFor));
    const records: DayRecord[] = [];
    wanted.forEach((day, i) => {
      const record = parseRecord(day, raws[i]);
      if (record) records.push(record);
    });
    return records;
  }

  return { saveDay, getDay, listDayKeys, listDays };
}
