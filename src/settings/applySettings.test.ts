import { createCountingEngine } from '../engine';
import { createDetectionRunner } from '../detection/detectionRunner';
import type { PillViewModel } from '../overlay/pillViewModel';
import { DEFAULT_SETTINGS } from './settings';
import { applySettings } from './applySettings';

const runners: { stop(): void }[] = [];
afterEach(() => runners.splice(0).forEach((r) => r.stop()));

function rig() {
  let now = new Date(2026, 0, 10, 12, 0, 0).getTime();
  const clock = { now: () => now };
  const engine = createCountingEngine({ clock });
  const rendered: PillViewModel[] = [];
  let hidden = 0;
  const runner = createDetectionRunner({
    clock,
    engine,
    pill: { render: (p) => rendered.push(p), hide: () => (hidden += 1) },
  });
  runners.push(runner);
  const pillPrefs: Record<string, unknown>[] = [];
  const rolloverHours: number[] = [];
  const locales: string[] = [];
  let deviceLocale: string | null = 'en-US';
  const targets = {
    engine,
    runner,
    setPillPreferences: (p: Record<string, unknown>) => pillPrefs.push(p),
    setRecorderRolloverHour: (h: number) => rolloverHours.push(h),
    deviceLocale: () => deviceLocale,
    setLocale: (l: string) => locales.push(l),
  };
  return {
    targets,
    runner,
    rendered,
    pillPrefs,
    rolloverHours,
    locales,
    setDevice: (tag: string | null) => {
      deviceLocale = tag;
    },
    hidden: () => hidden,
    watch(videos: number) {
      runner.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
      for (let i = 1; i < videos; i += 1) {
        now += 6000;
        runner.handle({ type: 'videoChanged', platform: 'tiktok' });
      }
    },
  };
}

describe('applySettings', () => {
  it('feeds the thresholds to the engine so the Tier updates at once', () => {
    const r = rig();
    r.watch(6);
    expect(r.runner.getState().tier).toBe(0);
    applySettings(
      { ...DEFAULT_SETTINGS, thresholds: { videos: [5, 30, 60, 120], minutes: [10, 30, 60, 120] } },
      r.targets,
    );
    expect(r.runner.getState().tier).toBe(1);
    // The pill is redrawn with the new Tier right away.
    expect(r.rendered[r.rendered.length - 1].tier).toBe(1);
  });

  it('feeds the rollover hour to the engine and to the recorder', () => {
    const r = rig();
    applySettings({ ...DEFAULT_SETTINGS, rolloverHour: 2 }, r.targets);
    expect(r.rolloverHours).toEqual([2]);
  });

  it('hides the pill when the overlay is switched off', () => {
    const r = rig();
    r.watch(1);
    expect(r.runner.isPillShown()).toBe(true);
    applySettings({ ...DEFAULT_SETTINGS, overlayEnabled: false }, r.targets);
    expect(r.runner.isPillShown()).toBe(false);
    expect(r.hidden()).toBe(1);
    applySettings({ ...DEFAULT_SETTINGS, overlayEnabled: true }, r.targets);
    expect(r.runner.isPillShown()).toBe(true);
  });

  it('passes compact mode, haptics and position to the pill preferences', () => {
    const r = rig();
    applySettings(
      { ...DEFAULT_SETTINGS, compactMode: true, haptics: false, positionDp: 56 },
      r.targets,
    );
    expect(r.pillPrefs).toEqual([
      { compact: true, haptics: false, positionDp: 56, locale: 'en' },
    ]);
  });

  it('puts the preferences in place before the pill is redrawn', () => {
    const order: string[] = [];
    applySettings(DEFAULT_SETTINGS, {
      engine: { configure: () => order.push('engine') },
      runner: { setPillEnabled: () => order.push('redraw') },
      setPillPreferences: () => order.push('prefs'),
      setRecorderRolloverHour: () => order.push('recorder'),
      deviceLocale: () => null,
      setLocale: () => order.push('locale'),
    });
    expect(order[order.length - 1]).toBe('redraw');
    expect(order).toEqual(expect.arrayContaining(['engine', 'prefs', 'recorder', 'locale']));
  });
});

describe('applySettings language', () => {
  it('puts the chosen language into force for the app, the pill and native text', () => {
    const r = rig();
    applySettings({ ...DEFAULT_SETTINGS, language: 'id' }, r.targets);
    expect(r.locales).toEqual(['id']);
    expect(r.pillPrefs[r.pillPrefs.length - 1]).toMatchObject({ locale: 'id' });
  });

  it('follows the device language for System, and falls back to English for one it lacks', () => {
    const r = rig();
    r.setDevice('id-ID');
    applySettings(DEFAULT_SETTINGS, r.targets);
    r.setDevice('de-DE');
    applySettings(DEFAULT_SETTINGS, r.targets);
    expect(r.locales).toEqual(['id', 'en']);
  });
});
