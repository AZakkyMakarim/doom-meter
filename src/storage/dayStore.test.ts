import { createDayStore, emptyDayRecord } from './dayStore';
import type { DayRecord } from './dayStore';
import { createMemoryKeyValueStore } from './memoryKeyValueStore';

function record(day: string, tiktok: Partial<DayRecord['platforms']['tiktok']> = {}): DayRecord {
  const r = emptyDayRecord(day);
  r.platforms.tiktok = { ...r.platforms.tiktok, ...tiktok };
  return r;
}

describe('day store', () => {
  it('returns null for a Day that was never saved', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    expect(await store.getDay('2026-10-15')).toBeNull();
  });

  it('round-trips one record per Platform per Day', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    const saved = record('2026-10-15', { watchedVideos: 12, watchTimeMs: 90_000, incomplete: true });
    await store.saveDay(saved);

    expect(await store.getDay('2026-10-15')).toEqual(saved);
  });

  it('survives a restart: a new store over the same data reads the same record', async () => {
    const kv = createMemoryKeyValueStore();
    await createDayStore(kv).saveDay(record('2026-10-15', { watchedVideos: 7 }));

    const reopened = createDayStore(kv);
    expect((await reopened.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(7);
  });

  it('never lets a stale write lower a count: counts only grow within a Day', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    await store.saveDay(record('2026-10-15', { watchedVideos: 12, watchTimeMs: 90_000 }));
    await store.saveDay(record('2026-10-15', { watchedVideos: 3, watchTimeMs: 20_000 }));

    const platform = (await store.getDay('2026-10-15'))?.platforms.tiktok;
    expect(platform?.watchedVideos).toBe(12);
    expect(platform?.watchTimeMs).toBe(90_000);
  });

  it('keeps the incomplete flag once it is set', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    await store.saveDay(record('2026-10-15', { incomplete: true }));
    await store.saveDay(record('2026-10-15', { watchedVideos: 5, incomplete: false }));

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.incomplete).toBe(true);
  });

  it('lists Days newest first, optionally limited', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    await store.saveDay(record('2026-10-13'));
    await store.saveDay(record('2026-10-15'));
    await store.saveDay(record('2026-10-14'));

    expect(await store.listDayKeys()).toEqual(['2026-10-15', '2026-10-14', '2026-10-13']);
    const days = await store.listDays(2);
    expect(days.map((d) => d.day)).toEqual(['2026-10-15', '2026-10-14']);
  });

  it('ignores keys that are not Day records', async () => {
    const kv = createMemoryKeyValueStore();
    await kv.set('doommeter:settings', '{}');
    const store = createDayStore(kv);
    await store.saveDay(record('2026-10-15'));

    expect(await store.listDayKeys()).toEqual(['2026-10-15']);
  });

  it('treats corrupt data as missing instead of throwing', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDayStore(kv);
    await store.saveDay(record('2026-10-14', { watchedVideos: 4 }));
    await kv.set('doommeter:v1:day:2026-10-15', '{not json');

    expect(await store.getDay('2026-10-15')).toBeNull();
    expect((await store.listDays()).map((d) => d.day)).toEqual(['2026-10-14']);
  });

  it('repairs invalid numbers and missing Platforms when reading', async () => {
    const kv = createMemoryKeyValueStore();
    await kv.set(
      'doommeter:v1:day:2026-10-15',
      JSON.stringify({
        day: '2026-10-15',
        platforms: { tiktok: { watchedVideos: -2, watchTimeMs: 'x', incomplete: 'yes' } },
      }),
    );
    const read = await createDayStore(kv).getDay('2026-10-15');

    expect(read?.platforms.tiktok).toEqual({ watchedVideos: 0, watchTimeMs: 0, incomplete: false });
    expect(read?.platforms.instagram).toEqual({
      watchedVideos: 0,
      watchTimeMs: 0,
      incomplete: false,
    });
  });

  it('reads a Day stored before Facebook existed with Facebook at zero, and can save over it', async () => {
    const kv = createMemoryKeyValueStore();
    const zero = { watchedVideos: 0, watchTimeMs: 0, incomplete: false };
    await kv.set(
      'doommeter:v1:day:2026-10-15',
      JSON.stringify({
        day: '2026-10-15',
        platforms: {
          instagram: zero,
          youtube: zero,
          tiktok: { watchedVideos: 5, watchTimeMs: 30_000, incomplete: false },
        },
      }),
    );
    const store = createDayStore(kv);
    const read = await store.getDay('2026-10-15');
    expect(read?.platforms.facebook).toEqual(zero);
    expect(read?.platforms.tiktok.watchedVideos).toBe(5);

    const next = emptyDayRecord('2026-10-15');
    next.platforms.facebook = { watchedVideos: 2, watchTimeMs: 12_000, incomplete: false };
    await store.saveDay(next);
    const saved = await store.getDay('2026-10-15');
    expect(saved?.platforms.facebook.watchedVideos).toBe(2);
    expect(saved?.platforms.tiktok.watchedVideos).toBe(5);
  });

  it('keeps concurrent saves of the same Day from losing data', async () => {
    const store = createDayStore(createMemoryKeyValueStore());
    await Promise.all([
      store.saveDay(record('2026-10-15', { watchedVideos: 2 })),
      store.saveDay(record('2026-10-15', { watchedVideos: 9 })),
      store.saveDay(record('2026-10-15', { watchedVideos: 5 })),
    ]);

    expect((await store.getDay('2026-10-15'))?.platforms.tiktok.watchedVideos).toBe(9);
  });
});
