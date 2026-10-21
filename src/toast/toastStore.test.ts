import { msg } from '../i18n/translate';
import { TOAST_DURATION_MS, createToastStore } from './toastStore';

const saved = { variant: 'success', message: msg('settings.saved') } as const;

describe('toast store', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows a toast for about 2.5 seconds, then clears it', () => {
    const store = createToastStore();
    expect(store.get()).toBeNull();
    store.show(saved);
    expect(store.get()).toMatchObject(saved);
    jest.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(store.get()).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(store.get()).toBeNull();
    expect(TOAST_DURATION_MS).toBe(2500);
  });

  it('replaces a toast that is still showing instead of stacking, and restarts the time', () => {
    const store = createToastStore();
    store.show(saved);
    const first = store.get()!;
    jest.advanceTimersByTime(2000);
    store.show(saved);
    expect(store.get()!.id).not.toBe(first.id);
    jest.advanceTimersByTime(2000); // the first one would be gone by now
    expect(store.get()).not.toBeNull();
    jest.advanceTimersByTime(500);
    expect(store.get()).toBeNull();
  });

  it('carries the failure variant for later tickets', () => {
    const store = createToastStore();
    store.show({ variant: 'failure', message: msg('settings.error.save') });
    expect(store.get()?.variant).toBe('failure');
  });

  it('tells subscribers about every change and stops after unsubscribe', () => {
    const store = createToastStore();
    const seen: unknown[] = [];
    const off = store.subscribe((toast) => seen.push(toast?.variant ?? null));
    store.show(saved);
    jest.advanceTimersByTime(TOAST_DURATION_MS);
    off();
    store.show(saved);
    expect(seen).toEqual(['success', null]);
  });
});
