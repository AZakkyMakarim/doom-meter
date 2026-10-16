import type { DayRecord } from '../storage';

export interface StoredDaysSource {
  /** Resolves when every Day write started so far has finished (the Day recorder). */
  settled(): Promise<void>;
  listDays(limit: number): Promise<DayRecord[]>;
}

/**
 * Reads up to `limit` stored Days, newest first, after pending writes have finished. When
 * the current Day rolls over the finished Day is written at that moment; reading before
 * the write lands would show yesterday as stale or missing.
 */
export async function readStoredDays(source: StoredDaysSource, limit: number): Promise<DayRecord[]> {
  await source.settled().catch(() => undefined);
  return source.listDays(limit);
}
