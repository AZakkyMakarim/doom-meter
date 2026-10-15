import { NativeModules, Platform } from 'react-native';
import type { PermissionId, PermissionStatus } from './permissionState';

interface NativePermissionsModule {
  getStatus(): Promise<PermissionStatus>;
  /** Opens the system settings screen where the user fixes this permission. */
  openSettings(permission: PermissionId): void;
}

const native: NativePermissionsModule | undefined =
  Platform.OS === 'android' ? NativeModules.DoomMeterPermissions : undefined;

/** Nothing is on and nothing is asked for: what a device without the native module reports. */
const NONE: PermissionStatus = {
  accessibility: false,
  overlay: false,
  usageAccess: false,
  notifications: false,
  notificationsApplicable: false,
};

export const permissions = {
  async getStatus(): Promise<PermissionStatus> {
    return native ? native.getStatus() : NONE;
  },
  openSettings(permission: PermissionId): void {
    native?.openSettings(permission);
  },
};
