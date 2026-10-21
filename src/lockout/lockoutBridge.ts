import { NativeModules, Platform } from 'react-native';

interface NativeLockoutModule {
  /** Saves the block screen view model (JSON) on the device, where the AccessibilityService reads it. */
  update(lockoutJson: string): void;
}

const native: NativeLockoutModule | undefined =
  Platform.OS === 'android' ? NativeModules.DoomMeterLockout : undefined;

export const lockoutNative = {
  update(json: string) {
    native?.update(json);
  },
};
