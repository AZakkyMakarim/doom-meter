/**
 * Which permissions DoomMeter needs, which are missing, and what the app says about it.
 * Pure rules, no device calls: the native check lives in permissionsBridge.ts and the
 * screens only draw what these functions return (PRD stories 47-52, MASTER 6.5).
 *
 * Required: Accessibility (sees the swipe feed) and Overlay (draws the pill).
 * Optional: Usage Access (Watch time fallback) and Notifications (foreground service, Android 13+).
 */

import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { joinList, t } from '../i18n/translate';

export type PermissionId = 'accessibility' | 'overlay' | 'usageAccess' | 'notifications';

export const PERMISSION_IDS: readonly PermissionId[] = [
  'accessibility',
  'overlay',
  'usageAccess',
  'notifications',
];

export interface PermissionStatus {
  accessibility: boolean;
  overlay: boolean;
  usageAccess: boolean;
  notifications: boolean;
  /** False below Android 13, where notifications need no permission and are never asked for. */
  notificationsApplicable: boolean;
}

export interface PermissionInfo {
  id: PermissionId;
  /** The name the user sees in the system settings. */
  title: string;
  /** One sentence: why DoomMeter asks for it. */
  purpose: string;
  required: boolean;
}

/** Accessibility and Overlay are required; the other two only add to what the app can do. */
const REQUIRED: Record<PermissionId, boolean> = {
  accessibility: true,
  overlay: true,
  usageAccess: false,
  notifications: false,
};

export function permissionInfo(id: PermissionId, locale: Locale = DEFAULT_LOCALE): PermissionInfo {
  return {
    id,
    title: t(locale, `permission.${id}.title`),
    purpose: t(locale, `permission.${id}.purpose`),
    required: REQUIRED[id],
  };
}

/** Required permissions that are off, in the order the user should fix them. */
export function missingRequired(status: PermissionStatus): PermissionId[] {
  return PERMISSION_IDS.filter((id) => REQUIRED[id] && !status[id]);
}

/** Optional permissions that are off; never a reason to warn. */
export function missingOptional(status: PermissionStatus): PermissionId[] {
  return PERMISSION_IDS.filter((id) => {
    if (REQUIRED[id] || status[id]) return false;
    return id !== 'notifications' || status.notificationsApplicable;
  });
}

/** True when both required permissions are on, so the pill and the count can work. */
export function isCounting(status: PermissionStatus): boolean {
  return missingRequired(status).length === 0;
}

export interface PermissionFix {
  permission: PermissionId;
  label: string;
  accessibilityLabel: string;
}

export interface PermissionBanner {
  message: string;
  fixes: PermissionFix[];
}

/**
 * The in-app banner for a revoked required permission. `null` status means the first
 * check has not finished yet: show nothing rather than flash a false warning.
 */
export function permissionBanner(
  status: PermissionStatus | null,
  locale: Locale = DEFAULT_LOCALE,
): PermissionBanner | null {
  if (status === null) return null;
  const missing = missingRequired(status);
  if (missing.length === 0) return null;
  const names = joinList(
    locale,
    missing.map((id) => permissionInfo(id, locale).title),
  );
  return {
    message: t(locale, 'permission.banner', { names }),
    fixes: missing.map((id) => ({
      permission: id,
      label: t(locale, 'permission.fix'),
      accessibilityLabel: t(locale, 'permission.fixNamed', {
        name: permissionInfo(id, locale).title,
      }),
    })),
  };
}

export interface NotCountingNotice {
  title: string;
  message: string;
}

/** Replaces the Today empty state ("nothing watched yet"), which would be untrue when nothing is counted. */
export function notCountingNotice(
  status: PermissionStatus | null,
  locale: Locale = DEFAULT_LOCALE,
): NotCountingNotice | null {
  if (status === null || isCounting(status)) return null;
  return {
    title: t(locale, 'permission.notCountingTitle'),
    message: t(locale, 'permission.notCountingMessage'),
  };
}
