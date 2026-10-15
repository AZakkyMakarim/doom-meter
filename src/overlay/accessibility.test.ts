import { contrastRatio } from '../design/contrast';
import { createCountingEngine } from '../engine';
import type { EngineState, Tier } from '../engine';
import { createPillPresenter, pillViewModelFor, setPillPreferences } from './pillViewModel';

const TIER_VIDEOS = [0, 10, 30, 60, 120];

/** Build an engine state by driving the real engine, so tests only use its public behavior. */
function stateWith(videos: number): EngineState {
  let now = 1_700_000_000_000;
  const engine = createCountingEngine({ clock: { now: () => now } });
  engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
  for (let i = 0; i < videos; i += 1) {
    now += 6000;
    engine.handle({ type: 'videoChanged', platform: 'tiktok' });
  }
  engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
  return engine.getState();
}

const atTier = (tier: Tier) => stateWith(TIER_VIDEOS[tier]);

afterEach(() => setPillPreferences({ reducedMotion: false, haptics: true }));

describe('panel colors (MASTER 8)', () => {
  it('draws Platform chip text that reads on every chip color', () => {
    const panel = pillViewModelFor(stateWith(30)).panel;
    for (const row of panel.rows) {
      expect(contrastRatio(panel.chipTextColor, row.color)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives every panel row a screen reader label that says the percent in words', () => {
    const panel = pillViewModelFor(stateWith(30)).panel;
    for (const row of panel.rows) {
      expect(row.contentDescription).toMatch(/\d+ percent$/);
    }
  });

  it('caps the panel at 60% of the height in landscape', () => {
    expect(pillViewModelFor(stateWith(0)).panel.landscapeMaxHeightFraction).toBe(0.6);
  });
});

describe('reduced motion (MASTER 7, 11)', () => {
  it('plays every motion by default', () => {
    expect(pillViewModelFor(atTier(4)).motion).toEqual({
      pulse: true,
      numberRoll: true,
      scalePop: true,
      panelSpring: true,
      borderCrossfade: true,
    });
  });

  it('turns off the pulse, the number roll and the scale pop', () => {
    const pill = pillViewModelFor(atTier(4), { reducedMotion: true });
    expect(pill.motion.pulse).toBe(false);
    expect(pill.motion.numberRoll).toBe(false);
    expect(pill.motion.scalePop).toBe(false);
  });

  it('also swaps the panel and the border instantly', () => {
    const pill = pillViewModelFor(atTier(2), { reducedMotion: true });
    expect(pill.motion.panelSpring).toBe(false);
    expect(pill.motion.borderCrossfade).toBe(false);
  });

  it.each([2, 3, 4] as const)('Tier %i has no pulse period under reduced motion', (tier) => {
    expect(pillViewModelFor(atTier(tier)).pulseMs).not.toBeNull();
    expect(pillViewModelFor(atTier(tier), { reducedMotion: true }).pulseMs).toBeNull();
  });

  it('keeps severity readable: same size, border, avatar and label', () => {
    const full = pillViewModelFor(atTier(4));
    const reduced = pillViewModelFor(atTier(4), { reducedMotion: true });
    expect(reduced.heightDp).toBe(full.heightDp);
    expect(reduced.borderWidthDp).toBe(full.borderWidthDp);
    expect(reduced.avatar).toBe(full.avatar);
    expect(reduced.labelText).toBe(full.labelText);
    expect(reduced.accentColor).toBe(full.accentColor);
  });

  it('keeps the haptic on a Tier increase', () => {
    const present = createPillPresenter();
    present(atTier(3), { reducedMotion: true });
    const raised = present(atTier(4), { reducedMotion: true });
    expect(raised.tierChange).toBe('increase');
    expect(raised.haptic).toBe('heavyDouble');
  });

  it('follows the saved preference when the presenter gets no options', () => {
    const present = createPillPresenter();
    setPillPreferences({ reducedMotion: true });
    const pill = present(atTier(3));
    expect(pill.motion.pulse).toBe(false);
    expect(pill.pulseMs).toBeNull();
  });
});

describe('screen reader announcements (MASTER 8, 11)', () => {
  it('say nothing on the first draw', () => {
    const present = createPillPresenter();
    expect(present(atTier(2)).announcement).toBeNull();
  });

  it('say nothing when only the count or time changes', () => {
    const present = createPillPresenter();
    present(stateWith(11));
    for (const videos of [12, 13, 14, 25]) {
      expect(present(stateWith(videos)).announcement).toBeNull();
    }
  });

  it.each([
    [1, 'Level 2 of 5, Drifting.'],
    [2, 'Level 3 of 5, Doomed.'],
    [3, 'Level 4 of 5, Cooked.'],
    [4, 'Level 5 of 5, Terminal.'],
  ] as const)('announce entering Tier %i once', (tier, spoken) => {
    const present = createPillPresenter();
    present(atTier((tier - 1) as Tier));
    expect(present(atTier(tier)).announcement).toBe(spoken);
    // The next update inside the same Tier is silent again.
    expect(present(atTier(tier)).announcement).toBeNull();
  });

  it('announce a decrease (Day rollover) too, since the Tier changed', () => {
    const present = createPillPresenter();
    present(atTier(3));
    expect(present(atTier(0)).announcement).toBe('Level 1 of 5, Fresh.');
  });

  it('keep the label read on focus separate from the announcement', () => {
    const pill = pillViewModelFor(stateWith(47));
    expect(pill.contentDescription).toMatch(/^Doom meter\. 47 videos, .*Level 3 of 5, Doomed\.$/);
    expect(pill.announcement).toBeNull();
  });
});
