import { msg, translate } from '../i18n/translate';
import { DEFAULT_SETTINGS, POSITION_MAX_DP, POSITION_STEP_DP } from './settings';
import {
  draftsFor,
  inlineError,
  lockoutNotice,
  lockoutStatusText,
  parseRolloverDraft,
  parseThresholdDrafts,
  permissionRows,
  positionControl,
  punishmentRows,
  rolloverLabel,
} from './settingsViewModel';

describe('threshold drafts', () => {
  it('shows the saved thresholds as text, one row per Tier 1 to 4', () => {
    const d = draftsFor(DEFAULT_SETTINGS);
    expect(d.thresholds).toEqual([
      { tierName: 'Cooked', videos: '10', minutes: '10' },
      { tierName: 'Washed', videos: '30', minutes: '30' },
      { tierName: 'Brainrot', videos: '60', minutes: '60' },
      { tierName: 'Doomed', videos: '120', minutes: '120' },
    ]);
    expect(d.rolloverHour).toBe('4');
  });

  it('turns typed text into thresholds (Tier 1 count lowered to 5)', () => {
    const rows = draftsFor(DEFAULT_SETTINGS).thresholds.map((r) => ({ ...r }));
    rows[0].videos = '5';
    const result = parseThresholdDrafts(rows);
    expect(result).toEqual({
      ok: true,
      value: { videos: [5, 30, 60, 120], minutes: [10, 30, 60, 120] },
    });
  });

  it('names the field when something is not a whole number', () => {
    const rows = draftsFor(DEFAULT_SETTINGS).thresholds.map((r) => ({ ...r }));
    rows[1].minutes = 'abc';
    const result = parseThresholdDrafts(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(translate('en', result.error)).toMatch(/Washed.*minutes.*whole number/i);
  });

  it('refuses an empty field', () => {
    const rows = draftsFor(DEFAULT_SETTINGS).thresholds.map((r) => ({ ...r }));
    rows[3].videos = '  ';
    expect(parseThresholdDrafts(rows).ok).toBe(false);
  });
});

describe('rollover draft', () => {
  it('parses a valid hour', () => {
    expect(parseRolloverDraft('2')).toEqual({ ok: true, value: 2 });
  });

  it('refuses text that is not a whole number', () => {
    const result = parseRolloverDraft('four');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(translate('en', result.error)).toMatch(/0 to 23/);
  });

  it('leaves the range check (25) to the settings rules', () => {
    expect(parseRolloverDraft('25')).toEqual({ ok: true, value: 25 });
  });

  it('labels the hour as a clock time', () => {
    expect(rolloverLabel(4)).toBe('04:00');
    expect(rolloverLabel(0)).toBe('00:00');
    expect(rolloverLabel(23)).toBe('23:00');
  });
});

describe('position control (non-gesture alternative to dragging)', () => {
  it('at the top, only moving down is possible', () => {
    const c = positionControl(0);
    expect(c.canMoveUp).toBe(false);
    expect(c.canMoveDown).toBe(true);
    expect(c.nextDown).toBe(POSITION_STEP_DP);
    expect(c.valueText).toBe('Top');
  });

  it('in the middle, moves by one step either way', () => {
    const c = positionControl(48);
    expect(c.nextUp).toBe(48 - POSITION_STEP_DP);
    expect(c.nextDown).toBe(48 + POSITION_STEP_DP);
    expect(c.valueText).toBe('48 dp below the top');
  });

  it('at the bottom of the band, only moving up is possible', () => {
    const c = positionControl(POSITION_MAX_DP);
    expect(c.canMoveDown).toBe(false);
    expect(c.canMoveUp).toBe(true);
  });

  it('never goes outside the band', () => {
    expect(positionControl(4).nextUp).toBe(0);
    expect(positionControl(POSITION_MAX_DP - 4).nextDown).toBe(POSITION_MAX_DP);
  });
});

describe('permission rows', () => {
  const all = { overlayGranted: true, accessibilityOn: true, usageAccessGranted: true };

  it('lists Usage access with a Fix permission action when it was skipped', () => {
    const usage = permissionRows({ ...all, usageAccessGranted: false })[2];
    expect(usage.title).toBe('Usage access');
    expect(usage.granted).toBe(false);
    expect(usage.statusText).toMatch(/not granted/i);
    expect(usage.fixLabel).toBe('Fix permission');
    expect(usage.explanation.length).toBeGreaterThan(0);
    expect(usage.accessibilityLabel).toMatch(/Usage access/);
    expect(usage.accessibilityLabel).toMatch(/optional/i);
  });

  it('shows Usage access as granted with no action once it is on', () => {
    const usage = permissionRows(all)[2];
    expect(usage.granted).toBe(true);
    expect(usage.statusText).toBe('Granted');
    expect(usage.fixLabel).toBeNull();
  });

  it('labels Usage access Optional, as onboarding does, and the others Required', () => {
    const rows = permissionRows(all);
    expect(rows.map((r) => r.badge)).toEqual(['Required', 'Required', 'Optional']);
    expect(rows.map((r) => r.required)).toEqual([true, true, false]);
  });

  it('keeps the Overlay and Accessibility rows unchanged when Usage access is missing', () => {
    const rows = permissionRows({ ...all, usageAccessGranted: false });
    expect(rows[0]).toMatchObject({ id: 'overlay', granted: true, statusText: 'Granted', fixLabel: null });
    expect(rows[1]).toMatchObject({ id: 'accessibility', granted: true, statusText: 'On', fixLabel: null });
  });

  it('shows a Fix permission action only for what is missing', () => {
    const rows = permissionRows({ ...all, accessibilityOn: false });
    expect(rows.map((r) => r.id)).toEqual(['overlay', 'accessibility', 'usageAccess']);
    expect(rows[0].granted).toBe(true);
    expect(rows[0].fixLabel).toBeNull();
    expect(rows[1].granted).toBe(false);
    expect(rows[1].fixLabel).toBe('Fix permission');
    expect(rows[1].statusText).toMatch(/off/i);
    expect(rows[1].explanation.length).toBeGreaterThan(0);
  });

  it('has a spoken label that carries the status', () => {
    const [overlay] = permissionRows({ ...all, overlayGranted: false });
    expect(overlay.accessibilityLabel).toMatch(/Display over other apps/);
    expect(overlay.accessibilityLabel).toMatch(/missing|off|not/i);
  });
});

describe('Settings text by locale', () => {
  it('reads in English by default', () => {
    expect(positionControl(0).valueText).toBe('Top');
    expect(positionControl(16).valueText).toBe('16 dp below the top');
    const [overlay] = permissionRows({
      overlayGranted: false,
      accessibilityOn: true,
      usageAccessGranted: true,
    });
    expect(overlay.title).toBe('Display over other apps');
    expect(overlay.explanation).toBe('Lets the pill appear on top of Instagram, YouTube, TikTok and Facebook.');
    expect(overlay.accessibilityLabel).toBe('Display over other apps: Missing');
  });

  it('takes the language as a parameter, in Indonesian', () => {
    expect(positionControl(0, 'id').valueText).toBe('Atas');
    expect(draftsFor(DEFAULT_SETTINGS, 'id').thresholds[0].tierName).toBe('Oleng');
    const rows = permissionRows(
      { overlayGranted: true, accessibilityOn: false, usageAccessGranted: false },
      'id',
    );
    expect(rows[1].fixLabel).toBe('Perbaiki izin');
    expect(rows[2].accessibilityLabel).toBe('Akses penggunaan, opsional: Belum diizinkan');
  });
});


describe('punishment card', () => {
  it('has a row for each of Tiers 1 to 4 with the five options, all Off by default, and none for Vibing', () => {
    const rows = punishmentRows(DEFAULT_SETTINGS.punishments);
    expect(rows.map((r) => [r.tier, r.tierName])).toEqual([
      [1, 'Cooked'],
      [2, 'Washed'],
      [3, 'Brainrot'],
      [4, 'Doomed'],
    ]);
    for (const row of rows) {
      expect(row.options.map((o) => o.label)).toEqual(['Off', '15 minutes', '1 hour', '3 hours', 'Until next Day']);
      expect(row.options.filter((o) => o.selected).map((o) => o.value)).toEqual(['off']);
    }
  });

  it('marks the saved choice of each Tier and sends the whole list when one Tier changes', () => {
    const rows = punishmentRows(['off', '1h', 'off', 'untilDay']);
    expect(rows[1].options.find((o) => o.selected)?.value).toBe('1h');
    expect(rows[1].label).toBe('Washed punishment');
    expect(rows[1].options.find((o) => o.value === '3h')?.patch).toEqual(['off', '3h', 'off', 'untilDay']);
  });

  it('reads in Indonesian', () => {
    const row = punishmentRows(DEFAULT_SETTINGS.punishments, 'id')[0];
    expect(row.label).toBe('Hukuman Oleng');
    expect(row.options.map((o) => o.label)).toEqual(['Mati', '15 menit', '1 jam', '3 jam', 'Sampai pergantian Hari']);
  });

  it('shows the status line only while a Lockout runs, with the local end time', () => {
    const endsAt = new Date(2026, 0, 10, 14, 5).getTime();
    expect(lockoutStatusText({ active: false })).toBeNull();
    const running = { active: true as const, tier: 1 as const, endsAt, platforms: [] };
    expect(lockoutStatusText(running)).toBe('Lockout active until 14:05');
    expect(lockoutStatusText(running, 'id')).toBe('Lockout aktif sampai 14:05');
  });

  it('says the three settings are read-only only while a Lockout runs', () => {
    const running = { active: true as const, tier: 1 as const, endsAt: 1, platforms: [] };
    expect(lockoutNotice({ active: false })).toBeNull();
    expect(lockoutNotice(running)).toBe('Read-only while a Lockout runs.');
    expect(lockoutNotice(running, 'id')).toBe('Hanya-baca selama Lockout berjalan.');
  });

  it('shows a refused change inline unless a Lockout refused it (that earns the failure toast)', () => {
    const error = msg('settings.error.save');
    expect(inlineError({ ok: true, settings: DEFAULT_SETTINGS })).toBeNull();
    expect(inlineError({ ok: false, error })).toBe(error);
    expect(inlineError({ ok: false, error, lockedUntil: 1 })).toBeNull();
  });
});
