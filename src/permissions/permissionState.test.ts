import {
  isCounting,
  missingOptional,
  missingRequired,
  notCountingNotice,
  permissionBanner,
  permissionInfo,
  PERMISSION_IDS,
} from './permissionState';
import type { PermissionStatus } from './permissionState';

const granted: PermissionStatus = {
  accessibility: true,
  overlay: true,
  usageAccess: true,
  notifications: true,
  notificationsApplicable: true,
};

function status(overrides: Partial<PermissionStatus>): PermissionStatus {
  return { ...granted, ...overrides };
}

describe('permission info', () => {
  it('separates required (Accessibility, Overlay) from optional (Usage Access, Notifications)', () => {
    expect(permissionInfo('accessibility').required).toBe(true);
    expect(permissionInfo('overlay').required).toBe(true);
    expect(permissionInfo('usageAccess').required).toBe(false);
    expect(permissionInfo('notifications').required).toBe(false);
  });

  it('gives every permission exactly one sentence of purpose', () => {
    for (const id of PERMISSION_IDS) {
      const { purpose } = permissionInfo(id);
      expect(purpose.match(/[.!?](\s|$)/g)).toHaveLength(1);
    }
  });
});

describe('what is missing', () => {
  it('reports nothing missing when everything is granted', () => {
    expect(missingRequired(granted)).toEqual([]);
    expect(missingOptional(granted)).toEqual([]);
    expect(isCounting(granted)).toBe(true);
  });

  it('reports a revoked required permission', () => {
    expect(missingRequired(status({ overlay: false }))).toEqual(['overlay']);
    expect(missingRequired(status({ accessibility: false, overlay: false }))).toEqual([
      'accessibility',
      'overlay',
    ]);
    expect(isCounting(status({ accessibility: false }))).toBe(false);
  });

  it('keeps counting without the optional permissions', () => {
    const skipped = status({ usageAccess: false, notifications: false });
    expect(isCounting(skipped)).toBe(true);
    expect(missingRequired(skipped)).toEqual([]);
    expect(missingOptional(skipped)).toEqual(['usageAccess', 'notifications']);
  });

  it('ignores notifications where the system does not ask for them', () => {
    const old = status({ notifications: false, notificationsApplicable: false });
    expect(missingOptional(old)).toEqual([]);
  });
});

describe('permission banner', () => {
  it('shows nothing before the first check has finished', () => {
    expect(permissionBanner(null)).toBeNull();
  });

  it('shows nothing when the required permissions are granted', () => {
    expect(permissionBanner(granted)).toBeNull();
  });

  it('shows nothing when only an optional permission is missing', () => {
    expect(permissionBanner(status({ usageAccess: false }))).toBeNull();
  });

  it('says it is not counting and offers a Fix permission action per missing permission', () => {
    const banner = permissionBanner(status({ overlay: false }));
    expect(banner?.message).toMatch(/not counting/i);
    expect(banner?.message).toMatch(/display over other apps/i);
    expect(banner?.fixes).toEqual([
      {
        permission: 'overlay',
        label: 'Fix permission',
        accessibilityLabel: 'Fix permission: Display over other apps',
      },
    ]);
  });

  it('lists every missing required permission, Accessibility first', () => {
    const banner = permissionBanner(status({ accessibility: false, overlay: false }));
    expect(banner?.fixes.map((f) => f.permission)).toEqual(['accessibility', 'overlay']);
  });
});

describe('not-counting notice for the Today empty state', () => {
  it('is absent while permissions are unknown or granted', () => {
    expect(notCountingNotice(null)).toBeNull();
    expect(notCountingNotice(granted)).toBeNull();
  });

  it('replaces the "nothing watched" message, which would be untrue without permissions', () => {
    const notice = notCountingNotice(status({ accessibility: false }));
    expect(notice?.title).toMatch(/not counting/i);
    expect(notice?.message).toMatch(/permission/i);
  });
});
