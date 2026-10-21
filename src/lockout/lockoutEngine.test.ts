import { PLATFORMS } from '../engine';
import { createMemoryKeyValueStore } from '../storage/memoryKeyValueStore';
import { DEFAULT_SETTINGS } from '../settings/settings';
import type { PunishmentRules } from '../settings/settings';
import { createLockoutEngine, LOCKOUT_KEY } from './lockoutEngine';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY1 = '2026-01-10';
const DAY2 = '2026-01-11';
const at = (d: number, h: number, m = 0) => new Date(2026, 0, d, h, m).getTime();

async function rig(
  punishments: PunishmentRules = ['off', 'off', 'off', 'off'],
  start = at(10, 12),
  store = createMemoryKeyValueStore(),
  load = true,
  seed = true,
) {
  let now = start;
  const engine = createLockoutEngine({ clock: { now: () => now }, store });
  engine.setRules({ punishments, rolloverHour: 4 });
  if (load) await engine.load();
  // The runtime's first look at the restored Day; with nothing saved it only seeds what was already reached.
  if (load && seed) engine.observeTier(DAY1, 0);
  return {
    engine,
    store,
    advance: (ms: number) => {
      now += ms;
    },
    setNow: (t: number) => {
      now = t;
    },
    now: () => now,
  };
}

/** A fresh engine over the same saved state, as after the phone restarts. */
type Rig = Awaited<ReturnType<typeof rig>>;

async function restart(from: Rig, punishments: PunishmentRules, now: number) {
  await from.engine.settled();
  const next = await rig(punishments, now, from.store);
  await next.engine.load();
  return next;
}

describe('starting a Lockout', () => {
  it('does nothing while the Punishment of the Tier is off', async () => {
    const { engine } = await rig();
    engine.observeTier(DAY1, 1);
    expect(engine.status().active).toBe(false);
  });

  it('starts when the Tier is reached, for the chosen length, blocking every Platform', async () => {
    const { engine, now } = await rig(['15m', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    expect(engine.status()).toEqual({ active: true, tier: 1, endsAt: now() + 15 * MIN, platforms: PLATFORMS });
  });

  it.each([
    ['1h', HOUR],
    ['3h', 3 * HOUR],
  ] as const)('lasts %s', async (option, ms) => {
    const { engine, now } = await rig([option, 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    const status = engine.status();
    expect(status.active && status.endsAt).toBe(now() + ms);
  });

  it('with "until the next Day" ends at the rollover hour', async () => {
    const { engine } = await rig(['untilDay', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    const status = engine.status();
    expect(status.active && status.endsAt).toBe(at(11, 4));
  });

  it('never starts for Vibing', async () => {
    const { engine } = await rig(['15m', '15m', '15m', '15m']);
    engine.observeTier(DAY1, 0);
    expect(engine.status().active).toBe(false);
  });

  it('tells listeners when it starts', async () => {
    const { engine } = await rig(['15m', 'off', 'off', 'off']);
    const seen: boolean[] = [];
    engine.subscribe(() => seen.push(engine.status().active));
    engine.observeTier(DAY1, 1);
    expect(seen).toEqual([true]);
  });
});

describe('ending and not repeating', () => {
  it('ends when the time is up', async () => {
    const { engine, advance } = await rig(['15m', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    advance(15 * MIN - 1);
    expect(engine.status().active).toBe(true);
    advance(1);
    expect(engine.status().active).toBe(false);
  });

  it('starts only the first time a Tier is reached in a Day', async () => {
    const { engine, advance } = await rig(['15m', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    advance(20 * MIN);
    engine.observeTier(DAY1, 1);
    engine.observeTier(DAY1, 0);
    engine.observeTier(DAY1, 1);
    expect(engine.status().active).toBe(false);
  });

  it('starts again in the next Day', async () => {
    const { engine, setNow } = await rig(['15m', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    setNow(at(11, 9));
    engine.observeTier(DAY2, 0);
    engine.observeTier(DAY2, 1);
    expect(engine.status().active).toBe(true);
  });

  it('does not punish a Tier that was reached while its Punishment was off', async () => {
    const { engine } = await rig();
    engine.observeTier(DAY1, 1);
    engine.setRules({ punishments: ['1h', 'off', 'off', 'off'], rolloverHour: 4 });
    engine.observeTier(DAY1, 1);
    expect(engine.status().active).toBe(false);
  });

  it('starts a Lockout for a Tier reached while another one runs', async () => {
    const { engine } = await rig(['off', '1h', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    engine.observeTier(DAY1, 2);
    expect(engine.status().active).toBe(true);
  });
});

describe('overriding', () => {
  it('counts a Tier that the count jumped over, so the longest Punishment wins', async () => {
    const { engine, now } = await rig(['3h', '15m', 'off', 'off']);
    engine.observeTier(DAY1, 2);
    expect(engine.status()).toMatchObject({ tier: 1, endsAt: now() + 3 * HOUR });
  });

  it('replaces a running Lockout with the longer one of a higher Tier', async () => {
    const { engine, now } = await rig(['15m', '3h', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    engine.observeTier(DAY1, 2);
    expect(engine.status()).toMatchObject({ tier: 2, endsAt: now() + 3 * HOUR });
  });

  it('keeps the running Lockout when the higher Tier would end sooner', async () => {
    const { engine, now } = await rig(['3h', '15m', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    engine.observeTier(DAY1, 2);
    expect(engine.status()).toMatchObject({ tier: 1, endsAt: now() + 3 * HOUR });
  });

  it('compares end times, so "until the next Day" can beat or lose to a timed Lockout', async () => {
    const late = await rig(['1h', 'untilDay', 'off', 'off'], at(10, 12));
    late.engine.observeTier(DAY1, 1);
    late.engine.observeTier(DAY1, 2);
    expect(late.engine.status()).toMatchObject({ tier: 2, endsAt: at(11, 4) });

    const soon = await rig(['3h', 'untilDay', 'off', 'off'], at(11, 2));
    soon.engine.observeTier(DAY1, 1);
    soon.engine.observeTier(DAY1, 2);
    expect(soon.engine.status()).toMatchObject({ tier: 1, endsAt: at(11, 5) });
  });
});

describe('surviving a restart and a rollover', () => {
  it('keeps the same end time after a restart', async () => {
    const first = await rig(['15m', 'off', 'off', 'off']);
    first.engine.observeTier(DAY1, 1);
    const before = first.engine.status();
    first.advance(5 * MIN);
    const second = await restart(first, ['15m', 'off', 'off', 'off'], first.now());
    expect(second.engine.status()).toEqual(before);
  });

  it('does not start the same Lockout again when the counts are restored after a restart', async () => {
    const first = await rig(['15m', 'off', 'off', 'off']);
    first.engine.observeTier(DAY1, 1);
    first.advance(30 * MIN);
    const second = await restart(first, ['15m', 'off', 'off', 'off'], first.now());
    second.engine.observeTier(DAY1, 0);
    second.engine.observeTier(DAY1, 1);
    expect(second.engine.status().active).toBe(false);
  });

  it('does not start from a Tier seen before the saved state was read, if that Tier was already reached', async () => {
    const first = await rig(['15m', 'off', 'off', 'off']);
    first.engine.observeTier(DAY1, 1);
    await first.engine.settled();
    const second = await rig(['15m', 'off', 'off', 'off'], first.now() + 30 * MIN, first.store, false);
    second.engine.observeTier(DAY1, 1);
    await second.engine.load();
    expect(second.engine.status().active).toBe(false);
  });

  describe('with nothing saved yet (first launch after an upgrade, or a corrupt save)', () => {
    const all15 = ['15m', '15m', '15m', '15m'] as PunishmentRules;

    it.each([
      ['missing', () => createMemoryKeyValueStore()],
      ['corrupt', () => createMemoryKeyValueStore({ [LOCKOUT_KEY]: '{"endsAt":"soon"' })],
    ])('does not punish the Tier the Day was already at (%s save)', async (_name, makeStore) => {
      const { engine } = await rig(all15, at(10, 12), makeStore(), true, false);
      engine.observeTier(DAY1, 2);
      expect(engine.status().active).toBe(false);
    });

    it('still punishes a higher Tier reached afterwards', async () => {
      const { engine, now } = await rig(['15m', '1h', '15m', '15m'], at(10, 12), createMemoryKeyValueStore(), true, false);
      engine.observeTier(DAY1, 1);
      engine.observeTier(DAY1, 2);
      expect(engine.status()).toMatchObject({ active: true, tier: 2, endsAt: now() + HOUR });
    });

    it('seeds from the first Tier seen before the load finished too', async () => {
      const { engine } = await rig(all15, at(10, 12), createMemoryKeyValueStore(), false);
      engine.observeTier(DAY1, 2);
      await engine.load();
      expect(engine.status().active).toBe(false);
    });

    it('keeps the seed across a restart', async () => {
      const first = await rig(all15, at(10, 12), createMemoryKeyValueStore(), true, false);
      first.engine.observeTier(DAY1, 2);
      const second = await restart(first, all15, first.now());
      second.engine.observeTier(DAY1, 2);
      expect(second.engine.status().active).toBe(false);
    });
  });

  it('survives the Day rollover while a timed Lockout runs', async () => {
    const first = await rig(['3h', 'off', 'off', 'off'], at(11, 3));
    first.engine.observeTier(DAY1, 1);
    first.setNow(at(11, 4, 30));
    const second = await restart(first, ['3h', 'off', 'off', 'off'], first.now());
    second.engine.observeTier(DAY2, 0);
    expect(second.engine.status()).toMatchObject({ active: true, endsAt: at(11, 6) });
  });

  it('ends "until the next Day" exactly at the rollover, even across a restart', async () => {
    const first = await rig(['untilDay', 'off', 'off', 'off'], at(11, 1));
    first.engine.observeTier(DAY1, 1);
    first.setNow(at(11, 3, 59));
    const second = await restart(first, ['untilDay', 'off', 'off', 'off'], first.now());
    expect(second.engine.status().active).toBe(true);
    second.setNow(at(11, 4));
    expect(second.engine.status().active).toBe(false);
  });

  it('starts clean when the saved state is missing or corrupt', async () => {
    const store = createMemoryKeyValueStore({ [LOCKOUT_KEY]: '{"endsAt":"soon"' });
    const { engine } = await rig(['off', 'off', 'off', 'off'], at(10, 12), store);
    await engine.load();
    expect(engine.status().active).toBe(false);
    const bad = createMemoryKeyValueStore({ [LOCKOUT_KEY]: JSON.stringify({ lockout: { endsAt: 'x', tier: 9 }, reached: 5 }) });
    const other = await rig(['off', 'off', 'off', 'off'], at(10, 12), bad);
    await other.engine.load();
    expect(other.engine.status().active).toBe(false);
  });
});

describe('refusing settings changes', () => {
  const locked = [
    { punishments: ['off', 'off', 'off', 'off'] as PunishmentRules },
    { thresholds: DEFAULT_SETTINGS.thresholds },
    { rolloverHour: 5 },
  ];

  it('allows every change while no Lockout runs', async () => {
    const { engine } = await rig();
    for (const patch of locked) expect(engine.refusal(patch)).toBeNull();
  });

  it.each(locked.map((patch) => [Object.keys(patch)[0], patch] as const))(
    'refuses %s during a Lockout and names when it ends',
    async (_name, patch) => {
      const { engine, now } = await rig(['15m', 'off', 'off', 'off']);
      engine.observeTier(DAY1, 1);
      expect(engine.refusal(patch)).toEqual({ endsAt: now() + 15 * MIN });
    },
  );

  it('still allows changes that do not weaken the Lockout', async () => {
    const { engine } = await rig(['15m', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    expect(engine.refusal({ overlayEnabled: false, language: 'id', compactMode: true, positionDp: 8 })).toBeNull();
  });

  describe('before the saved Lockout is read', () => {
    async function unloaded() {
      const first = await rig(['15m', 'off', 'off', 'off']);
      first.engine.observeTier(DAY1, 1);
      await first.engine.settled();
      return rig(['15m', 'off', 'off', 'off'], first.now() + 5 * MIN, first.store, false);
    }

    it('makes a protected change wait for the load, then refuses it if a Lockout runs', async () => {
      const { engine, now } = await unloaded();
      const pending = engine.refusal({ rolloverHour: 5 });
      expect(pending).toBeInstanceOf(Promise);
      await engine.load();
      await expect(pending).resolves.toEqual({ endsAt: now() + 10 * MIN });
    });

    it('lets a protected change through after the load when no Lockout runs', async () => {
      const { engine } = await rig(['off', 'off', 'off', 'off'], at(10, 12), createMemoryKeyValueStore(), false);
      const pending = engine.refusal({ punishments: ['off', 'off', 'off', 'off'] });
      await engine.load();
      await expect(pending).resolves.toBeNull();
    });

    it('does not make other changes wait', async () => {
      const { engine } = await unloaded();
      expect(engine.refusal({ compactMode: true })).toBeNull();
    });
  });

  it('allows them again once the Lockout is over', async () => {
    const { engine, advance } = await rig(['15m', 'off', 'off', 'off']);
    engine.observeTier(DAY1, 1);
    advance(15 * MIN);
    expect(engine.refusal({ rolloverHour: 5 })).toBeNull();
  });
});
