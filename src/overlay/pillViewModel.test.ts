import { createCountingEngine } from '../engine';
import type { EngineState, Tier } from '../engine';
import {
  createPillPresenter,
  isCompactMode,
  pillViewModelFor,
  setCompactMode,
  setPillPreferences,
} from './pillViewModel';

const MIN = 60_000;
const TIER_VIDEOS = [0, 10, 30, 60, 120];
const TIERS: Tier[] = [0, 1, 2, 3, 4];

/** Build an engine state by driving the real engine, so tests only use its public behavior. */
function stateWith(videos: number, watchTimeMs: number): EngineState {
  let now = 1_700_000_000_000;
  const engine = createCountingEngine({ clock: { now: () => now } });
  engine.handle({ type: 'surfaceFocusGained', platform: 'tiktok' });
  // Focusing the feed counts one video; each video stays 6s and any extra Watch time is
  // folded into the last one. Zero videos is not reachable, so it also gets the one.
  const extra = Math.max(0, watchTimeMs - videos * 6000);
  for (let i = 1; i < videos; i += 1) {
    now += 6000;
    engine.handle({ type: 'videoChanged', platform: 'tiktok' });
  }
  now += videos === 0 ? extra : 6000 + extra;
  engine.handle({ type: 'surfaceFocusLost', platform: 'tiktok' });
  return engine.getState();
}

function stateAtTier(tier: Tier): EngineState {
  return stateWith(TIER_VIDEOS[tier], 0);
}

function pillAtTier(tier: Tier) {
  return pillViewModelFor(stateAtTier(tier));
}

describe('pill text', () => {
  it('shows count, mm:ss time and the Tier label', () => {
    const pill = pillViewModelFor(stateWith(47, 38 * MIN + 12_000));
    expect(pill.countText).toBe('47');
    expect(pill.unitText).toBe('videos');
    expect(pill.timeText).toBe('38:12');
    expect(pill.labelText).toBe('Doomed');
  });

  it('switches to h:mm:ss from one hour', () => {
    const pill = pillViewModelFor(stateWith(0, 65 * MIN + 9000));
    expect(pill.timeText).toBe('1:05:09');
  });

  it('uses a singular unit for one video', () => {
    expect(pillViewModelFor(stateWith(1, 0)).unitText).toBe('video');
  });

  it('describes the whole state in one screen reader label', () => {
    const pill = pillViewModelFor(stateWith(47, 38 * MIN + 12_000));
    expect(pill.contentDescription).toBe(
      'Doom meter. 47 videos, 38 minutes 12 seconds. Level 3 of 5, Doomed.',
    );
  });

  it('announces only the Tier on its own', () => {
    expect(pillViewModelFor(stateWith(47, 0)).tierAnnouncement).toBe('Level 3 of 5, Doomed.');
  });

  it('includes hours in the screen reader label once past an hour', () => {
    const pill = pillViewModelFor(stateWith(0, 65 * MIN + 1000));
    expect(pill.contentDescription).toContain('1 hour 5 minutes 1 second.');
  });
});

describe('tier escalation (MASTER 2.1 and 2.2)', () => {
  it.each([
    [0, 'Fresh', '#34D399', 44, 20, 32],
    [1, 'Drifting', '#FACC15', 44, 20, 32],
    [2, 'Doomed', '#FB923C', 48, 22, 36],
    [3, 'Cooked', '#F87171', 52, 24, 40],
    [4, 'Terminal', '#FF4D8D', 56, 26, 44],
  ] as const)(
    'tier %i is %s with the right color and sizes',
    (tier, label, color, height, number, avatar) => {
      const pill = pillAtTier(tier);
      expect(pill.tier).toBe(tier);
      expect(pill.labelText).toBe(label);
      expect(pill.accentColor).toBe(color);
      expect(pill.heightDp).toBe(height);
      expect(pill.countSizeSp).toBe(number);
      expect(pill.avatarSizeDp).toBe(avatar);
    },
  );

  it('grows the border with the Tier', () => {
    expect(TIERS.map((t) => pillAtTier(t).borderWidthDp)).toEqual([1, 1.5, 2, 2, 3]);
  });

  it('draws the Tier 0 border at 40% opacity and the rest solid', () => {
    expect(pillAtTier(0).borderColor).toBe('#6634D399');
    expect(pillAtTier(1).borderColor).toBe('#FACC15');
    expect(pillAtTier(4).borderColor).toBe('#FF4D8D');
  });

  it('pulses only from Tier 2, faster each Tier', () => {
    expect(TIERS.map((t) => pillAtTier(t).pulseMs)).toEqual([null, null, 2400, 1600, 900]);
  });

  it('uses a distinct mood avatar per Tier', () => {
    expect(TIERS.map((t) => pillAtTier(t).avatar)).toEqual([
      'mood_0_fresh',
      'mood_1_drifting',
      'mood_2_doomed',
      'mood_3_cooked',
      'mood_4_terminal',
    ]);
  });

  it('carries surface and text colors as tokens so native holds no hex', () => {
    const pill = pillAtTier(0);
    expect(pill.surfaceColor).toBe('#0B0D14');
    expect(pill.textColor).toBe('#F8FAFC');
    expect(pill.mutedTextColor).toBe('#94A3B8');
  });
});

describe('createPillPresenter (what changed since the last update)', () => {
  it('does not animate or buzz on the first update', () => {
    const present = createPillPresenter();
    const pill = present(stateAtTier(2));
    expect(pill.tierChange).toBe('none');
    expect(pill.haptic).toBe('none');
  });

  it('does not animate or buzz when only the count changes', () => {
    const present = createPillPresenter();
    present(stateWith(11, 0));
    const pill = present(stateWith(12, 0));
    expect(pill.tierChange).toBe('none');
    expect(pill.haptic).toBe('none');
  });

  // MASTER 2.2: haptic on enter. T1 light, T2 medium, T3 heavy, T4 heavy x2.
  it.each([
    [1, 'light'],
    [2, 'medium'],
    [3, 'heavy'],
    [4, 'heavyDouble'],
  ] as const)('entering Tier %i buzzes %s', (tier, haptic) => {
    const present = createPillPresenter();
    present(stateAtTier((tier - 1) as Tier));
    const pill = present(stateAtTier(tier));
    expect(pill.tierChange).toBe('increase');
    expect(pill.haptic).toBe(haptic);
  });

  it('reports a Tier decrease (Day rollover) without a haptic', () => {
    const present = createPillPresenter();
    present(stateAtTier(3));
    const pill = present(stateAtTier(0));
    expect(pill.tierChange).toBe('decrease');
    expect(pill.haptic).toBe('none');
  });
});

describe('compact mode and panel (MASTER 6.1, 6.2)', () => {
  it('is the full pill by default', () => {
    expect(pillViewModelFor(stateAtTier(1)).compact).toBe(false);
  });

  it('keeps the same numbers and screen reader label in compact mode', () => {
    const full = pillViewModelFor(stateAtTier(2));
    const compact = pillViewModelFor(stateAtTier(2), { compact: true });
    expect(compact.compact).toBe(true);
    expect(compact.countText).toBe(full.countText);
    expect(compact.contentDescription).toBe(full.contentDescription);
  });

  it('carries the panel and the drag range so native holds no rules', () => {
    const pill = pillViewModelFor(stateAtTier(3));
    expect(pill.panel.tierName).toBe('Cooked');
    expect(pill.dragRangeDp).toBeGreaterThan(0);
  });

  it('the presenter follows the compact option on every update', () => {
    const present = createPillPresenter();
    expect(present(stateAtTier(0), { compact: true }).compact).toBe(true);
    expect(present(stateAtTier(0)).compact).toBe(false);
  });

  describe('compact preference', () => {
    afterEach(() => setCompactMode(false));

    it('applies to the presenter when no options are passed', () => {
      const present = createPillPresenter();
      setCompactMode(true);
      expect(isCompactMode()).toBe(true);
      expect(present(stateAtTier(0)).compact).toBe(true);
      setCompactMode(false);
      expect(present(stateAtTier(0)).compact).toBe(false);
    });
  });
});

describe('pill preferences set by Settings', () => {
  afterEach(() => setPillPreferences({ compact: false, haptics: true, positionDp: 0 }));

  it('carries the position so native places the pill without drag state of its own', () => {
    expect(pillViewModelFor(stateAtTier(0)).positionDp).toBe(0);
    expect(pillViewModelFor(stateAtTier(0), { positionDp: 48 }).positionDp).toBe(48);
  });

  it('presenter uses the saved position when no options are passed', () => {
    const present = createPillPresenter();
    setPillPreferences({ positionDp: 72 });
    expect(present(stateAtTier(0)).positionDp).toBe(72);
  });

  it('fires the Tier haptic by default and not when haptics are off', () => {
    const on = createPillPresenter();
    on(stateAtTier(1));
    expect(on(stateAtTier(3)).haptic).toBe('heavy');

    setPillPreferences({ haptics: false });
    const off = createPillPresenter();
    off(stateAtTier(1));
    const raised = off(stateAtTier(3));
    expect(raised.haptic).toBe('none');
    // The Tier change itself (animation, announcement) is unaffected.
    expect(raised.tierChange).toBe('increase');
  });

  it('keeps the position inside the drag band', () => {
    const pill = pillViewModelFor(stateAtTier(0), { positionDp: 9999 });
    expect(pill.positionDp).toBe(pill.dragRangeDp);
  });
});
