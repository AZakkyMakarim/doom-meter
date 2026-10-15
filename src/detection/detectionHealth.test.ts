import type { EngineEvent } from '../engine';
import { BLIND_AFTER_MS, createDetectionHealthMonitor } from './detectionHealth';
import type { HealthInput } from './detectionHealth';

const MIN = 60_000;

function setup() {
  const monitor = createDetectionHealthMonitor();
  const out: EngineEvent[] = [];
  return {
    out,
    send(...events: HealthInput[]) {
      events.forEach((e) => out.push(...monitor.observe(e)));
    },
    tick(now: number) {
      out.push(...monitor.tick(now));
    },
  };
}

describe('detection health: Accessibility service lost', () => {
  it('fails the Platform that was in the foreground when the service went away', () => {
    const { out, send } = setup();
    send({ type: 'accessibilityDisconnected', platform: 'tiktok', at: 1000 });

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'tiktok', at: 1000 }]);
  });

  it('does nothing when the service goes away with no Platform app in the foreground', () => {
    const { out, send } = setup();
    send({ type: 'accessibilityDisconnected', at: 1000 });

    expect(out).toEqual([]);
  });

  it('uses UsageStats to find the foreground Platform when native does not name one', () => {
    const { out, send } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'youtube', at: 0 },
      { type: 'accessibilityDisconnected', at: 5000 },
    );

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'youtube', at: 5000 }]);
  });

  it('fails a Platform that comes to the foreground while the service is gone', () => {
    const { out, send } = setup();
    send(
      { type: 'accessibilityDisconnected', at: 0 },
      { type: 'usageForegroundStarted', platform: 'instagram', at: 9000 },
    );

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'instagram', at: 9000 }]);
  });

  it('does not fail a Platform opened while the service is running', () => {
    const { out, send } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 9000 });

    expect(out).toEqual([]);
  });

  it('reports a Platform only once, however many times the service drops', () => {
    const { out, send } = setup();
    send(
      { type: 'accessibilityDisconnected', platform: 'tiktok', at: 0 },
      { type: 'accessibilityDisconnected', platform: 'tiktok', at: 500 },
    );

    expect(out).toHaveLength(1);
  });

  it('recovers every Platform that failed because of the service when it reconnects', () => {
    const { out, send } = setup();
    send(
      { type: 'accessibilityDisconnected', platform: 'tiktok', at: 0 },
      { type: 'accessibilityConnected', at: 60_000 },
    );

    expect(out).toEqual([
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'detectionHealthy', platform: 'tiktok', at: 60_000 },
    ]);
  });

  it('treats a surface appearing as proof the service is alive again', () => {
    const { out, send } = setup();
    send(
      { type: 'accessibilityDisconnected', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 5000 },
    );

    expect(out).toEqual([
      { type: 'detectionFailed', platform: 'tiktok', at: 0 },
      { type: 'detectionHealthy', platform: 'tiktok', at: 5000 },
    ]);
  });

  it('does not take a surface loss, which the dying service itself emits, as proof of life', () => {
    const { out, send } = setup();
    send(
      { type: 'surfaceFocusLost', platform: 'tiktok', at: 0 },
      { type: 'accessibilityDisconnected', platform: 'tiktok', at: 0 },
    );

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'tiktok', at: 0 }]);
  });

  it('leaves the failure in place when the user leaves the app, until the service is back', () => {
    const { out, send } = setup();
    send(
      { type: 'accessibilityDisconnected', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 5000 },
    );

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'tiktok', at: 0 }]);
  });
});

describe('detection health: a Platform app that shows no surface', () => {
  it('fails a Platform that stays in the foreground for a long time without ever showing a surface', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });

    tick(BLIND_AFTER_MS - 1);
    expect(out).toEqual([]);

    tick(BLIND_AFTER_MS);
    expect(out).toEqual([{ type: 'detectionFailed', platform: 'instagram', at: BLIND_AFTER_MS }]);
  });

  it('is conservative: the wait is 30 minutes', () => {
    expect(BLIND_AFTER_MS).toBe(30 * MIN);
  });

  it('does not fail a Platform that showed a surface during the stint', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'surfaceFocusGained', platform: 'instagram', at: 20_000 },
    );
    tick(BLIND_AFTER_MS * 3);

    expect(out).toEqual([]);
  });

  it('counts a surface reported before the foreground event arrives as seen', () => {
    // The two sources are separate streams, so their arrival order is not the order things happened.
    const { out, send, tick } = setup();
    send(
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 500 },
    );
    tick(BLIND_AFTER_MS * 3);

    expect(out).toEqual([]);
  });

  it('ignores a surface from before the stint began', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusLost', platform: 'tiktok', at: 1000 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 10 * MIN },
    );
    tick(10 * MIN + BLIND_AFTER_MS);

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'tiktok', at: 10 * MIN + BLIND_AFTER_MS }]);
  });

  it('does not fail a Platform whose stint ended before the wait was over', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'usageForegroundEnded', platform: 'instagram', at: 10 * MIN },
    );
    tick(BLIND_AFTER_MS * 2);

    expect(out).toEqual([]);
  });

  it('starts the wait again when the screen turns off and the app comes back', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'screenOff', at: 20 * MIN },
      { type: 'screenOn', at: 40 * MIN },
      { type: 'usageForegroundStarted', platform: 'instagram', at: 40 * MIN },
    );
    tick(40 * MIN + BLIND_AFTER_MS - 1);

    expect(out).toEqual([]);
  });

  it('is not used while the service is gone, which is already reported', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'accessibilityDisconnected', at: 0 },
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
    );
    tick(BLIND_AFTER_MS);

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'instagram', at: 0 }]);
  });

  it('reports a Platform only once per stretch of failure', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });
    tick(BLIND_AFTER_MS);
    tick(BLIND_AFTER_MS + 1000);

    expect(out).toHaveLength(1);
  });

  it('keeps the failure after the user leaves and clears it when a surface is seen again', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });
    tick(BLIND_AFTER_MS);
    send(
      { type: 'usageForegroundEnded', platform: 'instagram', at: BLIND_AFTER_MS + 1000 },
      { type: 'accessibilityConnected', at: BLIND_AFTER_MS + 2000 },
    );
    expect(out).toHaveLength(1);

    send({ type: 'surfaceFocusGained', platform: 'instagram', at: BLIND_AFTER_MS + 5000 });
    expect(out[1]).toEqual({
      type: 'detectionHealthy',
      platform: 'instagram',
      at: BLIND_AFTER_MS + 5000,
    });
  });

  it('stays failed while another reason is still active', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });
    tick(BLIND_AFTER_MS);
    send({ type: 'accessibilityDisconnected', platform: 'instagram', at: BLIND_AFTER_MS + 1 });
    send({ type: 'accessibilityConnected', at: BLIND_AFTER_MS + 2 });

    // Reconnecting clears the service reason only; no surface was seen, so it is still blind.
    expect(out.filter((e) => e.type === 'detectionHealthy')).toEqual([]);
  });
});
