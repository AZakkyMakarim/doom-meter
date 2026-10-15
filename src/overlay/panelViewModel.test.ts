import { createCountingEngine } from '../engine';
import type { EngineState, Platform } from '../engine';
import { panelViewModelFor } from './panelViewModel';

const MIN = 60_000;
const START = 1_700_000_000_000;

interface Watch {
  platform: Platform;
  videos: number;
  /** Total Watch time on this Platform in ms (at least videos * 6s). */
  timeMs: number;
}

/** Drive the real engine so tests only rely on its public behavior. */
function stateFrom(watches: Watch[]): EngineState {
  let now = START;
  const engine = createCountingEngine({ clock: { now: () => now } });
  for (const { platform, videos, timeMs } of watches) {
    engine.handle({ type: 'surfaceFocusGained', platform });
    const extra = Math.max(0, timeMs - videos * 6000);
    for (let i = 0; i < videos; i += 1) {
      now += 6000 + (i === videos - 1 ? extra : 0);
      engine.handle({ type: 'videoChanged', platform });
    }
    if (videos === 0) now += extra;
    engine.handle({ type: 'surfaceFocusLost', platform });
  }
  return engine.getState();
}

const mixed = () =>
  stateFrom([
    { platform: 'tiktok', videos: 30, timeMs: 20 * MIN },
    { platform: 'youtube', videos: 10, timeMs: 10 * MIN },
    { platform: 'instagram', videos: 7, timeMs: 10 * MIN },
  ]);

describe('panel header (MASTER 6.2 items 1 and 2)', () => {
  it('shows the large avatar, Tier name in the Tier color, and the totals', () => {
    const panel = panelViewModelFor(mixed());
    expect(panel.avatar).toBe('mood_2_doomed');
    expect(panel.avatarSizeDp).toBe(96);
    expect(panel.tierName).toBe('Doomed');
    expect(panel.accentColor).toBe('#FB923C');
    expect(panel.countText).toBe('47');
    expect(panel.unitText).toBe('videos');
    expect(panel.timeText).toBe('40:00');
  });

  it('uses the singular unit for one video', () => {
    const panel = panelViewModelFor(
      stateFrom([{ platform: 'tiktok', videos: 1, timeMs: 6000 }]),
    );
    expect(panel.unitText).toBe('video');
  });

  it('puts "Today" as the Day context', () => {
    expect(panelViewModelFor(mixed()).dayText).toBe('Today');
  });

  it('has an explicit close button, labelled for screen readers', () => {
    expect(panelViewModelFor(mixed()).closeLabel).toBe('Close');
  });

  it('carries surface colors as tokens so native holds no hex', () => {
    const panel = panelViewModelFor(mixed());
    expect(panel.surfaceColor).toBe('#0B0D14');
    expect(panel.rowColor).toBe('#151925');
    expect(panel.textColor).toBe('#F8FAFC');
    expect(panel.mutedTextColor).toBe('#94A3B8');
  });

  it('caps the panel at 60% of the screen height in landscape', () => {
    expect(panelViewModelFor(mixed()).landscapeMaxHeightFraction).toBe(0.6);
  });
});

describe('per-Platform breakdown (MASTER 6.2 item 3)', () => {
  it('lists every Platform in a fixed order with chip label and color', () => {
    const rows = panelViewModelFor(mixed()).rows;
    expect(rows.map(r => [r.platform, r.label, r.color])).toEqual([
      ['instagram', 'Reels', '#E1306C'],
      ['youtube', 'Shorts', '#FF3D3D'],
      ['tiktok', 'TikTok', '#25F4EE'],
    ]);
  });

  it('shows each Platform count and time', () => {
    const rows = panelViewModelFor(mixed()).rows;
    expect(rows.map(r => [r.countText, r.unitText, r.timeText])).toEqual([
      ['7', 'videos', '10:00'],
      ['10', 'videos', '10:00'],
      ['30', 'videos', '20:00'],
    ]);
  });

  it('sizes each bar by its share of total Watch time, with a numeric label', () => {
    const rows = panelViewModelFor(mixed()).rows;
    expect(rows.map(r => r.percent)).toEqual([25, 25, 50]);
    expect(rows.map(r => r.percentText)).toEqual(['25%', '25%', '50%']);
  });

  it('makes the rounded shares add up to 100', () => {
    const state = stateFrom([
      { platform: 'instagram', videos: 1, timeMs: 10 * MIN },
      { platform: 'youtube', videos: 1, timeMs: 10 * MIN },
      { platform: 'tiktok', videos: 1, timeMs: 10 * MIN },
    ]);
    const percents = panelViewModelFor(state).rows.map(r => r.percent);
    expect(percents.reduce((a, b) => a + b, 0)).toBe(100);
    expect(Math.max(...percents) - Math.min(...percents)).toBeLessThanOrEqual(
      1,
    );
  });

  it('shows empty bars, not NaN, before anything is watched', () => {
    const rows = panelViewModelFor(stateFrom([])).rows;
    expect(rows.map(r => r.percent)).toEqual([0, 0, 0]);
    expect(rows.map(r => r.percentText)).toEqual(['0%', '0%', '0%']);
    expect(rows.map(r => r.timeText)).toEqual(['00:00', '00:00', '00:00']);
  });

  it('gives each row one screen reader label with the numbers in words', () => {
    const rows = panelViewModelFor(mixed()).rows;
    expect(rows[2].contentDescription).toBe(
      'TikTok, 30 videos, 20 minutes 0 seconds, 50 percent',
    );
    expect(rows[0].contentDescription).toBe(
      'Reels, 7 videos, 10 minutes 0 seconds, 25 percent',
    );
  });
});

describe('screen reader summary', () => {
  it('describes the panel once, with the Day context', () => {
    expect(panelViewModelFor(mixed()).contentDescription).toBe(
      'Doom meter details for today. 47 videos, 40 minutes 0 seconds. Level 3 of 5, Doomed.',
    );
  });
});
