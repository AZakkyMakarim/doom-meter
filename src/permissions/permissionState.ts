/**
 * Which permissions DoomMeter needs, which are missing, and what the app says about it.
 * Pure rules, no device calls: the native check lives in permissionsBridge.ts and the
 * screens only draw what these functions return (PRD stories 47-52, MASTER 6.5).
 *
 * Required: Accessibility (sees the swipe feed) and Overlay (draws the pill).
 * Optional: Usage Access (Watch time fallback) and Notifications (foreground service, Android 13+).
 */

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

const INFO: Record<PermissionId, PermissionInfo> = {
  accessibility: {
    id: 'accessibility',
    title: 'Accessibility service',
    purpose:
      'DoomMeter uses it to notice when a short-form feed is open and a new video comes up, so it can count them.',
    required: true,
  },
  overlay: {
    id: 'overlay',
    title: 'Display over other apps',
    purpose: 'DoomMeter uses it to show the pill at the top of the screen while you scroll.',
    required: true,
  },
  usageAccess: {
    id: 'usageAccess',
    title: 'Usage access',
    purpose:
      'DoomMeter uses it only as a backup to keep Watch time right if video detection stops working.',
    required: false,
  },
  notifications: {
    id: 'notifications',
    title: 'Notifications',
    purpose: 'DoomMeter uses them to show the small notice that keeps counting alive in the background.',
    required: false,
  },
};

export function permissionInfo(id: PermissionId): PermissionInfo {
  return INFO[id];
}

/** Required permissions that are off, in the order the user should fix them. */
export function missingRequired(status: PermissionStatus): PermissionId[] {
  return PERMISSION_IDS.filter((id) => INFO[id].required && !status[id]);
}

/** Optional permissions that are off; never a reason to warn. */
export function missingOptional(status: PermissionStatus): PermissionId[] {
  return PERMISSION_IDS.filter((id) => {
    if (INFO[id].required || status[id]) return false;
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
export function permissionBanner(status: PermissionStatus | null): PermissionBanner | null {
  if (status === null) return null;
  const missing = missingRequired(status);
  if (missing.length === 0) return null;
  const names = missing.map((id) => INFO[id].title).join(' and ');
  return {
    message: `DoomMeter is not counting. Turn on ${names}.`,
    fixes: missing.map((id) => ({
      permission: id,
      label: 'Fix permission',
      accessibilityLabel: `Fix permission: ${INFO[id].title}`,
    })),
  };
}

export interface NotCountingNotice {
  title: string;
  message: string;
}

/** Replaces the Today empty state ("nothing watched yet"), which would be untrue when nothing is counted. */
export function notCountingNotice(status: PermissionStatus | null): NotCountingNotice | null {
  if (status === null || isCounting(status)) return null;
  return {
    title: 'Not counting yet',
    message: 'DoomMeter cannot see your scrolling until the missing permission is turned on.',
  };
}
