export interface LockoutEndWatch {
  endsAt: number;
  now: () => number;
  onTick: () => void;
}

/**
 * Calls `onTick` when a Lockout ends. A timer that fires a little early (while it is still running)
 * is armed again, so the screen never stays locked past the end. Returns the cancel function.
 */
export function watchLockoutEnd({ endsAt, now, onTick }: LockoutEndWatch): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    // shortcut: a timer longer than ~24 days would overflow; Lockouts are at most one Day, so it never does.
    timer = setTimeout(() => {
      onTick();
      if (now() < endsAt) arm();
    }, Math.max(0, endsAt - now()));
  };
  arm();
  return () => clearTimeout(timer);
}
