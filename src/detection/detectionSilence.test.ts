import type { EngineEvent } from '../engine';
import { SILENT_AFTER_MS, createDetectionHealthMonitor } from './detectionHealth';
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

describe('detection health: a Platform app that goes silent', () => {
  it('is conservative: the wait is 10 minutes', () => {
    expect(SILENT_AFTER_MS).toBe(10 * MIN);
  });

  it('fails a Platform in the foreground from which no accessibility activity arrives at all', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });

    tick(SILENT_AFTER_MS - 1);
    expect(out).toEqual([]);

    tick(SILENT_AFTER_MS);
    expect(out).toEqual([{ type: 'detectionFailed', platform: 'instagram', at: SILENT_AFTER_MS }]);
  });

  it('does not count the lack of a recognised Short-form surface as failure', () => {
    // A long YouTube video or Instagram DMs: the service keeps seeing the app, just no feed.
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'youtube', at: 0 });
    for (let t = MIN; t <= 3 * 60 * MIN; t += MIN) {
      send({ type: 'accessibilityActivity', platform: 'youtube', at: t });
      tick(t);
    }

    expect(out).toEqual([]);
  });

  it('measures the silence from the last activity, not from the start of the stint', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'accessibilityActivity', platform: 'instagram', at: 8 * MIN },
    );
    tick(8 * MIN + SILENT_AFTER_MS - 1);
    expect(out).toEqual([]);

    tick(8 * MIN + SILENT_AFTER_MS);
    expect(out).toEqual([
      { type: 'detectionFailed', platform: 'instagram', at: 8 * MIN + SILENT_AFTER_MS },
    ]);
  });

  it('treats a recognised surface as activity too', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 0 },
      { type: 'surfaceFocusGained', platform: 'tiktok', at: 1000 },
      { type: 'videoChanged', platform: 'tiktok', at: 9 * MIN },
    );
    tick(9 * MIN + SILENT_AFTER_MS - 1);

    expect(out).toEqual([]);
  });

  it('ignores activity from another Platform', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'accessibilityActivity', platform: 'tiktok', at: 5 * MIN },
    );
    tick(SILENT_AFTER_MS);

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'instagram', at: SILENT_AFTER_MS }]);
  });

  it('counts activity reported before the foreground event arrives as seen', () => {
    // The two sources are separate streams, so their arrival order is not the order things happened.
    const { out, send, tick } = setup();
    send(
      { type: 'accessibilityActivity', platform: 'tiktok', at: 5 * MIN },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 4 * MIN },
    );
    tick(5 * MIN + SILENT_AFTER_MS - 1);

    expect(out).toEqual([]);
  });

  it('ignores activity from before the stint began', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'accessibilityActivity', platform: 'tiktok', at: 0 },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 30 * MIN },
    );
    tick(30 * MIN + SILENT_AFTER_MS);

    expect(out).toEqual([
      { type: 'detectionFailed', platform: 'tiktok', at: 30 * MIN + SILENT_AFTER_MS },
    ]);
  });

  it('recovers as soon as activity is seen again', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });
    tick(SILENT_AFTER_MS);
    send({ type: 'accessibilityActivity', platform: 'instagram', at: SILENT_AFTER_MS + 1000 });

    expect(out).toEqual([
      { type: 'detectionFailed', platform: 'instagram', at: SILENT_AFTER_MS },
      { type: 'detectionHealthy', platform: 'instagram', at: SILENT_AFTER_MS + 1000 },
    ]);
  });

  it('does not fail a Platform whose stint ended before the wait was over', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'usageForegroundEnded', platform: 'instagram', at: 5 * MIN },
    );
    tick(SILENT_AFTER_MS * 3);

    expect(out).toEqual([]);
  });

  it('starts the wait again when the service reconnects', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'accessibilityDisconnected', at: MIN },
      { type: 'accessibilityConnected', at: 20 * MIN },
    );
    out.length = 0;
    tick(20 * MIN + SILENT_AFTER_MS - 1);

    expect(out).toEqual([]);
  });

  it('is not used while the service is gone, which is already reported', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'accessibilityDisconnected', at: 0 },
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
    );
    tick(SILENT_AFTER_MS);

    expect(out).toEqual([{ type: 'detectionFailed', platform: 'instagram', at: 0 }]);
  });

  it('reports a Platform only once per stretch of failure', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });
    tick(SILENT_AFTER_MS);
    tick(SILENT_AFTER_MS + 1000);

    expect(out).toHaveLength(1);
  });

  it('stays failed while another reason is still active', () => {
    const { out, send, tick } = setup();
    send({ type: 'usageForegroundStarted', platform: 'instagram', at: 0 });
    tick(SILENT_AFTER_MS);
    send({ type: 'accessibilityDisconnected', platform: 'instagram', at: SILENT_AFTER_MS + 1 });
    send({ type: 'accessibilityConnected', at: SILENT_AFTER_MS + 2 });

    // Reconnecting clears the service reason only; no activity was seen, so it is still silent.
    expect(out.filter((e) => e.type === 'detectionHealthy')).toEqual([]);
  });
});

describe('detection health: the screen turning off and on', () => {
  it('forgets the foreground app while the screen is off, so nothing is flagged for it', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'screenOff', at: MIN },
    );
    tick(SILENT_AFTER_MS * 3);

    expect(out).toEqual([]);
  });

  it('brings the foreground app back when the screen turns on, with a fresh wait', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'screenOff', at: MIN },
      { type: 'screenOn', at: 60 * MIN },
    );
    tick(60 * MIN + SILENT_AFTER_MS - 1);
    expect(out).toEqual([]);

    // No activity after the unlock: the restored foreground app is watched again.
    tick(60 * MIN + SILENT_AFTER_MS);
    expect(out).toEqual([
      { type: 'detectionFailed', platform: 'instagram', at: 60 * MIN + SILENT_AFTER_MS },
    ]);
  });

  it('does not bring back an app UsageStats reported as left while the screen was off', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'screenOff', at: MIN },
      { type: 'usageForegroundEnded', platform: 'instagram', at: MIN + 100 },
      { type: 'screenOn', at: 60 * MIN },
    );
    tick(60 * MIN + SILENT_AFTER_MS * 3);

    expect(out).toEqual([]);
  });

  it('does not bring back an app when another one came to the foreground meanwhile', () => {
    const { out, send, tick } = setup();
    send(
      { type: 'usageForegroundStarted', platform: 'instagram', at: 0 },
      { type: 'screenOff', at: MIN },
      { type: 'usageForegroundStarted', platform: 'tiktok', at: 2 * MIN },
      { type: 'usageForegroundEnded', platform: 'tiktok', at: 3 * MIN },
      { type: 'screenOn', at: 60 * MIN },
    );
    tick(60 * MIN + SILENT_AFTER_MS * 3);

    expect(out).toEqual([]);
  });
});
