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

