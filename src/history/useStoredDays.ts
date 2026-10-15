import { useEffect, useState } from 'react';
import { whenDaysSaved } from '../detection/runtime';
import { dayStore } from '../storage/deviceDayStore';
import { readStoredDays } from './storedDays';
import type { DayRecord } from '../storage';

export interface StoredDays {
  /** Newest first. Empty until the first read finishes. */
  records: DayRecord[];
  /** False until the first read finishes, so screens do not flash an empty state. */
  loaded: boolean;
  /** True once every stored Day has been read for this limit. */
  exhausted: boolean;
}

/**
 * Reads up to `limit` stored Days, again whenever `refreshKey` changes (the current
 * Day rolling over). A read that comes back after a newer one started is dropped.
 */
export function useStoredDays(limit: number, refreshKey: string): StoredDays {
  const [result, setResult] = useState<StoredDays>({
    records: [],
    loaded: false,
    exhausted: false,
  });

  useEffect(() => {
    let cancelled = false;
    // The Day that just ended is written as the rollover happens; wait for that write.
    readStoredDays({ settled: whenDaysSaved, listDays: dayStore.listDays }, limit)
      .then(records => {
        if (!cancelled)
          setResult({
            records,
            loaded: true,
            exhausted: records.length < limit,
          });
      })
      .catch(() => {
        // Unreadable storage shows as no data rather than an error screen.
        if (!cancelled)
          setResult({ records: [], loaded: true, exhausted: true });
      });
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey]);

  return result;
}
