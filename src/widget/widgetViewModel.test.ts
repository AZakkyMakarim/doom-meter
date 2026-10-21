import { createCountingEngine } from '../engine';
import type { EngineState } from '../engine';
import { widgetViewModelFor } from './widgetViewModel';

const T0 = new Date(2026, 9, 21, 12, 0, 0).getTime();

/** A state built through the real engine: `videos` swipes on TikTok, then `ms` of Watch time. */
function stateWith(videos: number, ms: number): EngineState {
  let now = T0;
  const engine = createCountingEngine({ clock: { now: () => now } });
  if (videos > 0 || ms > 0) {
    engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
    for (let i = 1; i < videos; i += 1) {
      now += 6000;
      engine.handle({ type: 'videoChanged', platform: 'tiktok' });
    }
    now += ms;
    engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
  }
  return engine.getState();
}

describe('Home widget view model', () => {
  it('shows the empty state when nothing has been counted today', () => {
    const vm = widgetViewModelFor(stateWith(0, 0), { rolloverHour: 4 });
    expect(vm.face.title).toBe('No data yet');
    expect(vm.face.countText).toBeNull();
    expect(vm.face.timeText).toBeNull();
    expect(vm.face.avatar).toBe('mood_0_vibing');
    expect(vm.face).toEqual(vm.emptyFace);
  });

  it('says it in Indonesian too', () => {
    const vm = widgetViewModelFor(stateWith(0, 0), { rolloverHour: 4, locale: 'id' });
    expect(vm.face.title).toBe('Belum ada data');
    expect(vm.locale).toBe('id');
  });

  it('shows the mood avatar, Tier label, Watched videos and Watch time', () => {
    const vm = widgetViewModelFor(stateWith(3, 65_000), { rolloverHour: 4 });
    expect(vm.face.avatar).toBe('mood_0_vibing');
    expect(vm.face.title).toBe('Vibing');
    expect(vm.face.countText).toBe('3');
    expect(vm.face.unitText).toBe('videos');
    expect(vm.face.timeText).toBe('01:17');
    expect(vm.face.accentColor).toBe('#FACC15');
    expect(vm.face.contentDescription).toBe(
      'Doom meter today. 3 videos, 1 minute 17 seconds. Level 1 of 5, Vibing.',
    );
  });

  it('follows the Tier', () => {
    const vm = widgetViewModelFor(stateWith(65, 0), { rolloverHour: 4 });
    expect(vm.face.avatar).toBe('mood_3_brainrot');
    expect(vm.face.title).toBe('Brainrot');
  });

  it('keeps the empty face for native to fall back on once the Day is over', () => {
    const vm = widgetViewModelFor(stateWith(3, 0), { rolloverHour: 4 });
    expect(vm.emptyFace.title).toBe('No data yet');
    expect(vm.face.title).toBe('Vibing');
  });

  it('knows when the Day ends, following the rollover hour', () => {
    const state = stateWith(3, 0);
    expect(widgetViewModelFor(state, { rolloverHour: 4 }).dayEndsAt).toBe(
      new Date(2026, 9, 22, 4).getTime(),
    );
    expect(widgetViewModelFor(state, { rolloverHour: 6 }).dayEndsAt).toBe(
      new Date(2026, 9, 22, 6).getTime(),
    );
  });
});
