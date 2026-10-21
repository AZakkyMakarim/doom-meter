import { useEffect, useState } from 'react';
import { debugClock, lockoutEngine } from '../detection/runtime';
import type { LockoutStatus } from './lockoutEngine';
import { watchLockoutEnd } from './lockoutEnd';

/** The Lockout as it is now, redrawn when one starts and again when it ends. */
export function useLockoutStatus(): LockoutStatus {
  const [, redraw] = useState(0);
  const status = lockoutEngine.status();
  const endsAt = status.active ? status.endsAt : null;
  useEffect(() => lockoutEngine.subscribe(() => redraw((n) => n + 1)), []);
  useEffect(() => {
    if (endsAt === null) return undefined;
    return watchLockoutEnd({ endsAt, now: () => debugClock.now(), onTick: () => redraw((n) => n + 1) });
  }, [endsAt]);
  return status;
}
