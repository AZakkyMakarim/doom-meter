import { watchReducedMotion } from './reducedMotion';

function fakeSystem(initial: boolean) {
  let listener: ((enabled: boolean) => void) | null = null;
  let removed = false;
  return {
    source: {
      isEnabled: () => Promise.resolve(initial),
      subscribe(cb: (enabled: boolean) => void) {
        listener = cb;
        return () => {
          removed = true;
        };
      },
    },
    change: (enabled: boolean) => listener?.(enabled),
    wasRemoved: () => removed,
  };
}

describe('watchReducedMotion', () => {
  it('reports the current system setting, then every change', async () => {
    const system = fakeSystem(true);
    const seen: boolean[] = [];
    watchReducedMotion(system.source, (enabled) => seen.push(enabled));
    await Promise.resolve();
    system.change(false);
    system.change(true);
    expect(seen).toEqual([true, false, true]);
  });

  it('stops listening when unsubscribed', () => {
    const system = fakeSystem(false);
    const stop = watchReducedMotion(system.source, () => undefined);
    stop();
    expect(system.wasRemoved()).toBe(true);
  });

  it('keeps full motion when the system setting cannot be read', async () => {
    const seen: boolean[] = [];
    watchReducedMotion(
      { isEnabled: () => Promise.reject(new Error('unavailable')), subscribe: () => () => undefined },
      (enabled) => seen.push(enabled),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]);
  });
});
