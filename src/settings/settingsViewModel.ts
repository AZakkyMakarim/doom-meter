import { PLATFORM_CATALOG } from '../design/catalog';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import type { MessageId } from '../i18n/messages.en';
import { tierLabel } from '../i18n/text';
import { joinList, msg, t } from '../i18n/translate';
import type { MessageRef } from '../i18n/translate';
import { permissionInfo } from '../permissions/permissionState';
import type { PermissionId } from '../permissions/permissionState';
import type { TierBounds, TierThresholds } from '../engine';
import type { LockoutStatus } from '../lockout/lockoutEngine';
import { clockLabel } from './clockLabel';
import {
  POSITION_MAX_DP,
  POSITION_MIN_DP,
  POSITION_STEP_DP,
  PUNISHMENT_OPTIONS,
  parseNumberDraft,
} from './settings';
import type { Punishment, PunishmentRules, Settings, SettingsResult } from './settings';

/**
 * What the Settings screen shows and how typed text becomes values. Pure, so the
 * validation messages and the position and permission logic are unit tested; the
 * screen only draws this (MASTER.md 6.4).
 */

export interface ThresholdDraftRow {
  /** Name of the Tier these numbers start (Tiers 1 to 4). */
  tierName: string;
  videos: string;
  minutes: string;
}

export interface SettingsDrafts {
  thresholds: ThresholdDraftRow[];
  rolloverHour: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: MessageRef };

/** The text fields as they read for the saved settings. */
export function draftsFor(settings: Settings, locale: Locale = DEFAULT_LOCALE): SettingsDrafts {
  return {
    // Tiers 1 to 4: the ones with thresholds.
    thresholds: [1, 2, 3, 4].map((tier, i) => ({
      tierName: tierLabel(tier, locale),
      videos: String(settings.thresholds.videos[i]),
      minutes: String(settings.thresholds.minutes[i]),
    })),
    rolloverHour: String(settings.rolloverHour),
  };
}

/** Typed threshold text to numbers; whether they are in range and ascending is up to the settings rules. */
export function parseThresholdDrafts(rows: readonly ThresholdDraftRow[]): Parsed<TierThresholds> {
  const videos: number[] = [];
  const minutes: number[] = [];
  for (const row of rows) {
    const v = parseNumberDraft(row.videos);
    if (v === null) return { ok: false, error: msg('settings.error.videosWhole', { tier: row.tierName }) };
    const m = parseNumberDraft(row.minutes);
    if (m === null) return { ok: false, error: msg('settings.error.minutesWhole', { tier: row.tierName }) };
    videos.push(v);
    minutes.push(m);
  }
  return {
    ok: true,
    value: { videos: videos as unknown as TierBounds, minutes: minutes as unknown as TierBounds } as TierThresholds,
  };
}

export function parseRolloverDraft(text: string): Parsed<number> {
  const hour = parseNumberDraft(text);
  if (hour === null) {
    return { ok: false, error: msg('settings.error.rollover') };
  }
  return { ok: true, value: hour };
}

/** The hour as a clock time, e.g. 04:00. */
export function rolloverLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export interface PunishmentRow {
  /** The Tier this row punishes (1 to 4). */
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  /** Names the group for screen readers, e.g. "Cooked punishment". */
  label: string;
  options: {
    value: Punishment;
    label: string;
    selected: boolean;
    /** The whole list of Punishments with this Tier set to this option. */
    patch: PunishmentRules;
  }[];
}

/** The Punishment card: one row per Tier from Cooked up (Vibing cannot be punished). */
export function punishmentRows(rules: PunishmentRules, locale: Locale = DEFAULT_LOCALE): PunishmentRow[] {
  return ([1, 2, 3, 4] as const).map((tier) => {
    const tierName = tierLabel(tier, locale);
    return {
      tier,
      tierName,
      label: t(locale, 'settings.punishment.rowLabel', { tier: tierName }),
      options: PUNISHMENT_OPTIONS.map((value) => ({
        value,
        label: t(locale, `settings.punishment.${value}`),
        selected: rules[tier - 1] === value,
        patch: rules.map((r, i) => (i === tier - 1 ? value : r)) as unknown as PunishmentRules,
      })),
    };
  });
}

/** "Lockout active until HH:MM" while a Lockout runs, otherwise null. */
export function lockoutStatusText(status: LockoutStatus, locale: Locale = DEFAULT_LOCALE): string | null {
  return status.active ? t(locale, 'settings.punishment.status', { time: clockLabel(status.endsAt) }) : null;
}

/** Why Punishment, thresholds and rollover hour cannot be edited, while a Lockout runs; otherwise null. */
export function lockoutNotice(status: LockoutStatus, locale: Locale = DEFAULT_LOCALE): string | null {
  return status.active ? t(locale, 'settings.lockout.readOnly') : null;
}

/** The reason to show beside a control for a refused change; a Lockout refusal has the toast instead. */
export function inlineError(result: SettingsResult): MessageRef | null {
  return result.ok || result.lockedUntil !== undefined ? null : result.error;
}

export interface PositionControl {
  valueText: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  nextUp: number;
  nextDown: number;
}

/** The Position control: stepping buttons instead of the drag gesture (MASTER 6.1). */
export function positionControl(positionDp: number, locale: Locale = DEFAULT_LOCALE): PositionControl {
  return {
    valueText:
      positionDp === 0
        ? t(locale, 'settings.position.top')
        : t(locale, 'settings.position.below', { dp: positionDp }),
    canMoveUp: positionDp > POSITION_MIN_DP,
    canMoveDown: positionDp < POSITION_MAX_DP,
    nextUp: Math.max(POSITION_MIN_DP, positionDp - POSITION_STEP_DP),
    nextDown: Math.min(POSITION_MAX_DP, positionDp + POSITION_STEP_DP),
  };
}

export interface PermissionRow {
  id: Extract<PermissionId, 'overlay' | 'accessibility' | 'usageAccess'>;
  title: string;
  /** Same wording as the onboarding badge. */
  badge: string;
  required: boolean;
  granted: boolean;
  statusText: string;
  /** Why DoomMeter needs it, shown beside a missing permission. */
  explanation: string;
  /** The action label when the permission is missing, otherwise null. */
  fixLabel: string | null;
  accessibilityLabel: string;
}

export function permissionRows(
  status: {
    overlayGranted: boolean;
    accessibilityOn: boolean;
    usageAccessGranted: boolean;
  },
  locale: Locale = DEFAULT_LOCALE,
): PermissionRow[] {
  const row = (
    id: PermissionRow['id'],
    granted: boolean,
    grantedText: MessageId,
    missingText: MessageId,
    explanation: string,
  ): PermissionRow => {
    const { title, required } = permissionInfo(id, locale);
    const stateText = t(locale, granted ? grantedText : missingText);
    return {
      id,
      title,
      badge: t(locale, required ? 'permission.required' : 'permission.optional'),
      required,
      granted,
      statusText: stateText,
      explanation,
      fixLabel: granted ? null : t(locale, 'permission.fix'),
      accessibilityLabel: t(locale, required ? 'settings.permission.rowRequired' : 'settings.permission.rowOptional', {
        title,
        state: stateText,
      }),
    };
  };
  return [
    row(
      'overlay',
      status.overlayGranted,
      'settings.permission.granted',
      'settings.permission.missing',
      t(locale, 'settings.permission.overlayWhy', {
        platforms: joinList(
          locale,
          PLATFORM_CATALOG.map((p) => p.name),
        ),
      }),
    ),
    row(
      'accessibility',
      status.accessibilityOn,
      'settings.permission.on',
      'settings.permission.off',
      t(locale, 'settings.permission.accessibilityWhy'),
    ),
    row(
      'usageAccess',
      status.usageAccessGranted,
      'settings.permission.granted',
      'settings.permission.notGranted',
      permissionInfo('usageAccess', locale).purpose,
    ),
  ];
}
