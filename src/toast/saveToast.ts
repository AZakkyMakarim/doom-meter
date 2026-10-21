import { msg } from '../i18n/translate';
import type { SettingsPatch, SettingsResult } from '../settings/settings';
import type { ToastContent } from './toastStore';

/**
 * The toast a settings save earns: "Settings saved" once a change is stored. The position
 * buttons and a pill drag stay silent, and a refused change shows its error inline instead.
 */
export function saveToastFor(patch: SettingsPatch, result: SettingsResult): ToastContent | null {
  // Other refusals (bad values) show inline; only a Lockout earns the failure toast.
  if (!result.ok) return result.lockedUntil === undefined ? null : { variant: 'failure', message: result.error };
  const announced = Object.entries(patch).filter(([key, value]) => key !== 'positionDp' && value !== undefined);
  if (announced.length === 0) return null;
  return { variant: 'success', message: msg('settings.saved') };
}
