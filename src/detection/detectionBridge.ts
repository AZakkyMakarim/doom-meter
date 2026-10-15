import { NativeModules, Platform } from 'react-native';

/** Name of the device event the native detection layer emits raw events on. */
export const RAW_EVENT_NAME = 'DoomMeterRawEvent';

interface NativeDetectionModule {
  isAccessibilityEnabled(): Promise<boolean>;
  /** Opens the system Accessibility settings, where the user enables the DoomMeter service. */
  openAccessibilitySettings(): void;
  /** Tells native that JavaScript is listening, so events buffered since cold start are flushed. */
  ready(): void;
  /**
   * Foreground changes of the Platform apps since the previous call, as raw event JSON,
   * oldest first. Empty unless Usage Access is granted.
   */
  pollUsageEvents(): Promise<string[]>;
  /** Starts the foreground service that keeps detection alive in the background. */
  startForegroundService(): void;
  stopForegroundService(): void;
}

const native: NativeDetectionModule | undefined =
  Platform.OS === 'android' ? NativeModules.DoomMeterDetection : undefined;

export const detectionNative = {
  async isAccessibilityEnabled(): Promise<boolean> {
    return native ? native.isAccessibilityEnabled() : false;
  },
  openAccessibilitySettings(): void {
    native?.openAccessibilitySettings();
  },
  ready(): void {
    native?.ready();
  },
  async pollUsageEvents(): Promise<string[]> {
    return native ? native.pollUsageEvents() : [];
  },
  startForegroundService(): void {
    native?.startForegroundService();
  },
  stopForegroundService(): void {
    native?.stopForegroundService();
  },
};
