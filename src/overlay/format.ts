/** Text formatting shared by the pill and the expanded panel (MASTER 4 and 8). */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function splitTime(watchTimeMs: number) {
  const totalSeconds = Math.floor(watchTimeMs / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** `mm:ss`, or `h:mm:ss` from one hour. */
export function formatTime(watchTimeMs: number): string {
  const { hours, minutes, seconds } = splitTime(watchTimeMs);
  return hours > 0
    ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
    : `${pad2(minutes)}:${pad2(seconds)}`;
}

export function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** Time in words for a screen reader. */
export function spokenTime(watchTimeMs: number): string {
  const { hours, minutes, seconds } = splitTime(watchTimeMs);
  const parts = [plural(minutes, 'minute'), plural(seconds, 'second')];
  if (hours > 0) parts.unshift(plural(hours, 'hour'));
  return parts.join(' ');
}
