import { watchLockoutEnd } from './lockoutEnd';

describe('watchLockoutEnd', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires once the Lockout has ended', () => {
    let now = 0;
    const onTick = jest.fn();
    watchLockoutEnd({ endsAt: 1000, now: () => now, onTick });
    now = 1000;
    jest.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('fires again when the timer fired early and the Lockout is still running', () => {
    let now = 0;
    const onTick = jest.fn();
    watchLockoutEnd({ endsAt: 1000, now: () => now, onTick });
    now = 990; // the timer fired 10 ms early
    jest.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    now = 1000;
    jest.advanceTimersByTime(10);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('stops when cancelled', () => {
    const onTick = jest.fn();
    const cancel = watchLockoutEnd({ endsAt: 1000, now: () => 0, onTick });
    cancel();
    jest.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();
  });
});
