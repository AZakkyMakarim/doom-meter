/** Shared text formatting for counts and Watch time (MASTER.md section 6.1). */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function split(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** `mm:ss`, or `h:mm:ss` from one hour on. */
export function formatClock(ms: number): string {
  const { hours, minutes, seconds } = split(ms);
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
}

export function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** For screen readers: `38 minutes 12 seconds`. */
export function spokenDuration(ms: number): string {
  const { hours, minutes, seconds } = split(ms);
  const parts = [plural(minutes, 'minute'), plural(seconds, 'second')];
  if (hours > 0) parts.unshift(plural(hours, 'hour'));
  return parts.join(' ');
}
