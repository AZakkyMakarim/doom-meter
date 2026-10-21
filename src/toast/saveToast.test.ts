import { msg } from '../i18n/translate';
import { DEFAULT_SETTINGS } from '../settings/settings';
import type { SettingsPatch, SettingsResult } from '../settings/settings';
import { saveToastFor } from './saveToast';

const ok: SettingsResult = { ok: true, settings: DEFAULT_SETTINGS };
const refused: SettingsResult = { ok: false, error: msg('settings.error.save') };

describe('when a settings save shows the success toast', () => {
  const shown: [string, SettingsPatch][] = [
    ['a toggle (overlay)', { overlayEnabled: false }],
    ['a toggle (compact mode)', { compactMode: true }],
    ['a toggle (haptics)', { haptics: false }],
    ['saved thresholds', { thresholds: DEFAULT_SETTINGS.thresholds }],
    ['the rollover hour', { rolloverHour: 3 }],
    ['the language', { language: 'id' }],
  ];

  it.each(shown)('shows "Settings saved" after %s is saved', (_name, patch) => {
    expect(saveToastFor(patch, ok)).toEqual({ variant: 'success', message: msg('settings.saved') });
  });

  it('shows nothing for the position buttons or a pill drag', () => {
    expect(saveToastFor({ positionDp: 48 }, ok)).toBeNull();
  });

  it('shows no success toast when the change was refused', () => {
    for (const [, patch] of shown) expect(saveToastFor(patch, refused)).toBeNull();
  });
});
