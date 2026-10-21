import { DEFAULT_ROLLOVER_HOUR, DEFAULT_TIER_THRESHOLDS } from '../engine';
import type { TierThresholds } from '../engine';
import { isLanguagePreference } from '../i18n/locale';
import type { LanguagePreference } from '../i18n/locale';
import { msg } from '../i18n/translate';
import type { MessageRef } from '../i18n/translate';
import { PILL_DRAG_RANGE_DP } from '../overlay/pillViewModel';

/**
 * User settings (MASTER.md 6.4) and the rules for what is a valid value. Pure: no
 * storage, no React Native; the store, the applier and the screen build on this.
 */
export interface Settings {
  /** Whether the Overlay pill may appear at all. */
  overlayEnabled: boolean;
  /** Compact mode: the pill shows the avatar and count only. */
  compactMode: boolean;
  /** Haptic on entering a higher Tier. */
  haptics: boolean;
  /** How far the pill sits below its top-edge anchor, in dp (0 = top). */
  positionDp: number;
  /** Local hour (0-23) at which a new Day starts. */
  rolloverHour: number;
  thresholds: TierThresholds;
  /** The language of the app, the pill and the notification; System follows the device. */
  language: LanguagePreference;
}

export const DEFAULT_SETTINGS: Settings = {
  overlayEnabled: true,
  compactMode: false,
  haptics: true,
  positionDp: 0,
  rolloverHour: DEFAULT_ROLLOVER_HOUR,
  thresholds: DEFAULT_TIER_THRESHOLDS,
  language: 'system',
};

export const POSITION_MIN_DP = 0;
export const POSITION_MAX_DP = PILL_DRAG_RANGE_DP;
export const POSITION_STEP_DP = 8;
export const MAX_VIDEO_THRESHOLD = 9999;
/** Watch time cannot exceed one Day. */
export const MAX_MINUTE_THRESHOLD = 1440;

export type SettingsPatch = Partial<Settings>;

export type SettingsResult = { ok: true; settings: Settings } | { ok: false; error: MessageRef };

function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** A position reported by a drag gesture, rounded and kept inside the band. */
export function positionFromDrag(dp: number): number {
  if (!Number.isFinite(dp)) return POSITION_MIN_DP;
  return Math.min(POSITION_MAX_DP, Math.max(POSITION_MIN_DP, Math.round(dp)));
}

/** A whole non-negative number typed into a field, or null when it is not one. */
export function parseNumberDraft(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function boundsError(
  bounds: readonly unknown[],
  series: 'videos' | 'minutes',
  max: number,
): MessageRef | null {
  const seriesName = msg(`series.${series}`);
  if (bounds.length !== 4 || !bounds.every(isWhole)) {
    return msg('settings.error.thresholdsWhole', { series: seriesName });
  }
  const values = bounds as number[];
  if (values.some((v) => v < 1 || v > max)) {
    return msg('settings.error.thresholdsRange', { series: seriesName, max });
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] <= values[i - 1]) {
      return msg('settings.error.thresholdsAscend', { series: seriesName, values: values.join(', ') });
    }
  }
  return null;
}

function thresholdsError(t: TierThresholds): MessageRef | null {
  return (
    boundsError(t?.videos ?? [], 'videos', MAX_VIDEO_THRESHOLD) ??
    boundsError(t?.minutes ?? [], 'minutes', MAX_MINUTE_THRESHOLD)
  );
}

function rolloverError(hour: unknown): MessageRef | null {
  return isWhole(hour) && hour >= 0 && hour <= 23 ? null : msg('settings.error.rollover');
}

function positionError(position: unknown): MessageRef | null {
  return isWhole(position) && position >= POSITION_MIN_DP && position <= POSITION_MAX_DP
    ? null
    : msg('settings.error.position', { min: POSITION_MIN_DP, max: POSITION_MAX_DP });
}

function languageError(language: unknown): MessageRef | null {
  return isLanguagePreference(language) ? null : msg('settings.error.language');
}

/** The first problem with a patch, or null when every field in it is valid. */
function patchError(patch: SettingsPatch): MessageRef | null {
  if (patch.rolloverHour !== undefined) {
    const e = rolloverError(patch.rolloverHour);
    if (e) return e;
  }
  if (patch.positionDp !== undefined) {
    const e = positionError(patch.positionDp);
    if (e) return e;
  }
  if (patch.thresholds !== undefined) {
    const e = thresholdsError(patch.thresholds);
    if (e) return e;
  }
  if (patch.language !== undefined) {
    const e = languageError(patch.language);
    if (e) return e;
  }
  return null;
}

/** Returns the settings with the patch applied, or the reason it is refused (nothing changes). */
export function applyPatch(current: Settings, patch: SettingsPatch): SettingsResult {
  const error = patchError(patch);
  if (error !== null) return { ok: false, error };
  const settings: Settings = { ...current };
  if (patch.overlayEnabled !== undefined) settings.overlayEnabled = patch.overlayEnabled;
  if (patch.compactMode !== undefined) settings.compactMode = patch.compactMode;
  if (patch.haptics !== undefined) settings.haptics = patch.haptics;
  if (patch.positionDp !== undefined) settings.positionDp = patch.positionDp;
  if (patch.rolloverHour !== undefined) settings.rolloverHour = patch.rolloverHour;
  if (patch.language !== undefined) settings.language = patch.language;
  if (patch.thresholds !== undefined) {
    const { videos, minutes } = patch.thresholds;
    settings.thresholds = {
      videos: [videos[0], videos[1], videos[2], videos[3]],
      minutes: [minutes[0], minutes[1], minutes[2], minutes[3]],
    };
  }
  return { ok: true, settings };
}

/**
 * Settings read back from storage. Each field is checked on its own and falls back to
 * its default, so one bad value never throws away the rest.
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const saved = raw as Record<string, unknown>;
  const patch: SettingsPatch = {};
  for (const key of ['overlayEnabled', 'compactMode', 'haptics'] as const) {
    if (typeof saved[key] === 'boolean') patch[key] = saved[key] as boolean;
  }
  if (languageError(saved.language) === null) patch.language = saved.language as LanguagePreference;
  if (rolloverError(saved.rolloverHour) === null) patch.rolloverHour = saved.rolloverHour as number;
  if (positionError(saved.positionDp) === null) patch.positionDp = saved.positionDp as number;
  const thresholds = saved.thresholds as TierThresholds | undefined;
  if (typeof thresholds === 'object' && thresholds !== null && thresholdsError(thresholds) === null) {
    patch.thresholds = thresholds;
  }
  const result = applyPatch(DEFAULT_SETTINGS, patch);
  return result.ok ? result.settings : DEFAULT_SETTINGS;
}
