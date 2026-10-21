import { PLATFORM_CATALOG, TIER_CATALOG } from '../design/catalog';
import { permissionInfo } from '../permissions/permissionState';
import type { PermissionId } from '../permissions/permissionState';
import type { TierBounds, TierThresholds } from '../engine';
import { POSITION_MAX_DP, POSITION_MIN_DP, POSITION_STEP_DP, parseNumberDraft } from './settings';
import type { Settings } from './settings';

/**
 * What the Settings screen shows and how typed text becomes values. Pure, so the
 * validation messages and the position and permission logic are unit tested; the
 * screen only draws this (MASTER.md 6.4).
 */

/** Tiers 1 to 4: the ones with thresholds. */
const TIER_NAMES = TIER_CATALOG.slice(1).map(t => t.label);

const PLATFORM_NAMES = PLATFORM_CATALOG.map(p => p.name);
const PLATFORM_NAME_LIST = `${PLATFORM_NAMES.slice(0, -1).join(', ')} and ${
  PLATFORM_NAMES[PLATFORM_NAMES.length - 1]
}`;

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

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The text fields as they read for the saved settings. */
export function draftsFor(settings: Settings): SettingsDrafts {
  return {
    thresholds: TIER_NAMES.map((tierName, i) => ({
      tierName,
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
    if (v === null) return { ok: false, error: `${row.tierName} videos must be a whole number.` };
    const m = parseNumberDraft(row.minutes);
    if (m === null) return { ok: false, error: `${row.tierName} minutes must be a whole number.` };
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
    return { ok: false, error: 'Day rollover hour must be a whole number from 0 to 23.' };
  }
  return { ok: true, value: hour };
}

/** The hour as a clock time, e.g. 04:00. */
export function rolloverLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export interface PositionControl {
  valueText: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  nextUp: number;
  nextDown: number;
}

/** The Position control: stepping buttons instead of the drag gesture (MASTER 6.1). */
export function positionControl(positionDp: number): PositionControl {
  return {
    valueText: positionDp === 0 ? 'Top' : `${positionDp} dp below the top`,
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
  badge: 'Required' | 'Optional';
  required: boolean;
  granted: boolean;
  statusText: string;
  /** Why DoomMeter needs it, shown beside a missing permission. */
  explanation: string;
  /** The action label when the permission is missing, otherwise null. */
  fixLabel: string | null;
  accessibilityLabel: string;
}

export function permissionRows(status: {
  overlayGranted: boolean;
  accessibilityOn: boolean;
  usageAccessGranted: boolean;
}): PermissionRow[] {
  const row = (
    id: PermissionRow['id'],
    title: string,
    granted: boolean,
    grantedText: string,
    missingText: string,
    explanation: string,
  ): PermissionRow => {
    const required = permissionInfo(id).required;
    const badge = required ? 'Required' : 'Optional';
    const stateText = granted ? grantedText : missingText;
    return {
      id,
      title,
      badge,
      required,
      granted,
      statusText: stateText,
      explanation,
      fixLabel: granted ? null : 'Fix permission',
      accessibilityLabel: required
        ? `${title}: ${stateText}`
        : `${title}, ${badge.toLowerCase()}: ${stateText}`,
    };
  };
  return [
    row(
      'overlay',
      'Display over other apps',
      status.overlayGranted,
      'Granted',
      'Missing',
      `Lets the pill appear on top of ${PLATFORM_NAME_LIST}.`,
    ),
    row(
      'accessibility',
      'Accessibility service',
      status.accessibilityOn,
      'On',
      'Off',
      'Lets DoomMeter see when you scroll short videos. Only counts are kept; no video content is read or stored.',
    ),
    row(
      'usageAccess',
      permissionInfo('usageAccess').title,
      status.usageAccessGranted,
      'Granted',
      'Not granted',
      permissionInfo('usageAccess').purpose,
    ),
  ];
}
