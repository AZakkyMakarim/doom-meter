import { NativeModules, Platform } from 'react-native';
import type { WidgetSink } from './widgetSync';

interface NativeWidgetModule {
  /** Saves the widget view model on the device and redraws every Home widget. */
  update(widgetJson: string): void;
}

const native: NativeWidgetModule | undefined =
  Platform.OS === 'android' ? NativeModules.DoomMeterWidget : undefined;

export const widgetNative: WidgetSink = {
  update(json) {
    native?.update(json);
  },
};
