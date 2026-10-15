export const DEFAULT_ROLLOVER_HOUR = 4;

export interface DayWindow {
  /** Local calendar date the Day started on, YYYY-MM-DD. */
  key: string;
  /** Epoch ms at which the next Day begins. */
  end: number;
}

export function assertRolloverHour(hour: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`rolloverHour must be an integer from 0 to 23, got ${hour}`);
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** When the Day labelled `key` ends under a given rollover hour. */
export function dayEndFor(key: string, rolloverHour: number): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d + 1, rolloverHour).getTime();
}

/**
 * The Day containing `t`: it starts at `rolloverHour` local time, so 00:30 still
 * belongs to the previous calendar date. Built from local calendar fields so it
 * follows the device time zone and DST.
 */
export function dayWindowAt(t: number, rolloverHour: number): DayWindow {
  const d = new Date(t);
  let y = d.getFullYear();
  let m = d.getMonth();
  let day = d.getDate();
  if (t < new Date(y, m, day, rolloverHour).getTime()) {
    const prev = new Date(y, m, day - 1);
    y = prev.getFullYear();
    m = prev.getMonth();
    day = prev.getDate();
  }
  return {
    key: `${y}-${pad(m + 1)}-${pad(day)}`,
    end: new Date(y, m, day + 1, rolloverHour).getTime(),
  };
}
