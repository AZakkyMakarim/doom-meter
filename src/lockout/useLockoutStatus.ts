import { useEffect, useState } from 'react';
import { debugClock, lockoutEngine } from '../detection/runtime';
import type { LockoutStatus } from './lockoutEngine';

/** The Lockout as it is now, redrawn when one starts and again when it ends. */
export function useLockoutStatus(): LockoutStatus {
  const [, redraw] = useState(0);
  const status = lockoutEngine.status();
  const endsAt = status.active ? status.endsAt : null;
  useEffect(() => lockoutEngine.subscribe(() => redraw((n) => n + 1)), []);
  useEffect(() => {
    if (endsAt === null) return undefined;
    // shortcut: a timer longer than ~24 days would overflow; Lockouts are at most one Day, so it never does.
    const timer = setTimeout(() => redraw((n) => n + 1), Math.max(0, endsAt - debugClock.now()));
    return () => clearTimeout(timer);
  }, [endsAt]);
  return status;
}
