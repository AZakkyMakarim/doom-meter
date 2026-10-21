import {
  DEFAULT_SETTINGS,
  POSITION_MAX_DP,
  applyPatch,
  parseNumberDraft,
  positionFromDrag,
  sanitizeSettings,
} from './settings';
import { translate } from '../i18n/translate';

describe('applyPatch', () => {
  it('accepts a valid change and leaves the rest alone', () => {
    const result = applyPatch(DEFAULT_SETTINGS, { compactMode: true, rolloverHour: 2 });
    expect(result).toEqual({
      ok: true,
      settings: { ...DEFAULT_SETTINGS, compactMode: true, rolloverHour: 2 },
    });
  });

  it.each([24, 25, -1, 3.5, Number.NaN])('rejects rollover hour %p with a message', (hour) => {
    const result = applyPatch(DEFAULT_SETTINGS, { rolloverHour: hour });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(translate('en', result.error)).toMatch(/0 to 23/);
  });

  it('accepts hour 0 and 23', () => {
    expect(applyPatch(DEFAULT_SETTINGS, { rolloverHour: 0 }).ok).toBe(true);
    expect(applyPatch(DEFAULT_SETTINGS, { rolloverHour: 23 }).ok).toBe(true);
  });

  it('lowers the Tier 1 video threshold', () => {
    const result = applyPatch(DEFAULT_SETTINGS, {
      thresholds: { videos: [5, 30, 60, 120], minutes: [10, 30, 60, 120] },
    });
    expect(result.ok && result.settings.thresholds.videos[0]).toBe(5);
  });

  it('rejects thresholds that are not strictly ascending and names the series', () => {
    const result = applyPatch(DEFAULT_SETTINGS, {
      thresholds: { videos: [10, 30, 30, 120], minutes: [10, 30, 60, 120] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(translate('en', result.error)).toMatch(/videos.*ascend/i);

    const minutes = applyPatch(DEFAULT_SETTINGS, {
      thresholds: { videos: [10, 30, 60, 120], minutes: [40, 30, 60, 120] },
    });
    expect(minutes.ok).toBe(false);
    if (!minutes.ok) expect(translate('en', minutes.error)).toMatch(/minutes/i);
  });

  it('rejects thresholds below 1 or not whole numbers', () => {
    expect(
      applyPatch(DEFAULT_SETTINGS, {
        thresholds: { videos: [0, 30, 60, 120], minutes: [10, 30, 60, 120] },
      }).ok,
    ).toBe(false);
    expect(
      applyPatch(DEFAULT_SETTINGS, {
        thresholds: { videos: [10.5, 30, 60, 120], minutes: [10, 30, 60, 120] },
      }).ok,
    ).toBe(false);
  });

  it('rejects a position outside the drag band', () => {
    expect(applyPatch(DEFAULT_SETTINGS, { positionDp: -8 }).ok).toBe(false);
    expect(applyPatch(DEFAULT_SETTINGS, { positionDp: 1000 }).ok).toBe(false);
    expect(applyPatch(DEFAULT_SETTINGS, { positionDp: 64 }).ok).toBe(true);
  });

  it('does not mutate the current settings when it rejects', () => {
    const before = JSON.stringify(DEFAULT_SETTINGS);
    applyPatch(DEFAULT_SETTINGS, { rolloverHour: 99 });
    expect(JSON.stringify(DEFAULT_SETTINGS)).toBe(before);
  });
});

describe('positionFromDrag', () => {
  it('rounds and clamps what the drag gesture reports', () => {
    expect(positionFromDrag(47.6)).toBe(48);
    expect(positionFromDrag(-12)).toBe(0);
    expect(positionFromDrag(5000)).toBe(POSITION_MAX_DP);
    expect(positionFromDrag(Number.NaN)).toBe(0);
  });
});

describe('parseNumberDraft', () => {
  it('parses whole numbers and trims spaces', () => {
    expect(parseNumberDraft(' 12 ')).toBe(12);
  });
  it.each(['', 'abc', '1.5', '-3', '1e3'])('returns null for %p', (text) => {
    expect(parseNumberDraft(text)).toBeNull();
  });
});

describe('sanitizeSettings', () => {
  it('returns defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and replaces invalid ones with defaults', () => {
    const saved = sanitizeSettings({
      overlayEnabled: false,
      compactMode: 'yes',
      rolloverHour: 30,
      positionDp: 40,
      thresholds: { videos: [5, 30, 60, 120], minutes: [3, 2, 1, 0] },
    });
    expect(saved.overlayEnabled).toBe(false);
    expect(saved.compactMode).toBe(DEFAULT_SETTINGS.compactMode);
    expect(saved.rolloverHour).toBe(DEFAULT_SETTINGS.rolloverHour);
    expect(saved.positionDp).toBe(40);
    expect(saved.thresholds).toEqual(DEFAULT_SETTINGS.thresholds);
  });
});

describe('language', () => {
  it('follows the device language until the user picks one', () => {
    expect(DEFAULT_SETTINGS.language).toBe('system');
  });

  it('accepts System, English and Indonesian, and refuses anything else', () => {
    for (const language of ['system', 'en', 'id'] as const) {
      expect(applyPatch(DEFAULT_SETTINGS, { language })).toEqual({
        ok: true,
        settings: { ...DEFAULT_SETTINGS, language },
      });
    }
    const refused = applyPatch(DEFAULT_SETTINGS, { language: 'de' as never });
    expect(refused.ok).toBe(false);
  });

  it('reads Days saved before the language existed as System, and ignores a bad saved value', () => {
    expect(sanitizeSettings({ compactMode: true }).language).toBe('system');
    expect(sanitizeSettings({ language: 'id' }).language).toBe('id');
    expect(sanitizeSettings({ language: 'xx' }).language).toBe('system');
  });
});
