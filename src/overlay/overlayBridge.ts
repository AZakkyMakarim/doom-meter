import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import type { PillViewModel } from './pillViewModel';

/** Device event native emits when the user finishes dragging the pill; the payload is dp below the top anchor. */
export const PILL_MOVED_EVENT = 'DoomMeterPillMoved';

interface NativeOverlayModule {
  hasPermission(): Promise<boolean>;
  /** Opens the system screen where the user grants "Display over other apps". */
  requestPermission(): void;
  /** Draws the pill, or updates it when already shown. A no-op without the permission. */
  render(pillJson: string): void;
  hide(): void;
}

const native: NativeOverlayModule | undefined =
  Platform.OS === 'android' ? NativeModules.DoomMeterOverlay : undefined;

export const overlay = {
  async hasPermission(): Promise<boolean> {
    return native ? native.hasPermission() : false;
  },
  requestPermission(): void {
    native?.requestPermission();
  },
  render(pill: PillViewModel): void {
    native?.render(JSON.stringify(pill));
  },
  hide(): void {
    native?.hide();
  },
  /** Called with the new position (dp below the top anchor) when a drag ends. Returns the unsubscribe function. */
  onMoved(listener: (positionDp: number) => void): () => void {
    const sub = DeviceEventEmitter.addListener(PILL_MOVED_EVENT, (dp: unknown) => {
      if (typeof dp === 'number') listener(dp);
    });
    return () => sub.remove();
  },
};
