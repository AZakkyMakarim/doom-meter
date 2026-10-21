import type { EngineConfig } from '../engine';
import { resolveLocale } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import type { LockoutRules } from '../lockout/lockoutEngine';
import type { PillOptions } from '../overlay/pillViewModel';
import type { Settings } from './settings';

/** Where settings take effect. Each is a narrow seam so the logic here is testable without a device. */
export interface SettingsTargets {
  engine: { configure(config: EngineConfig): void };
  /** The detection runner: switching the pill on or off also redraws it. */
  runner: { setPillEnabled(enabled: boolean): void };
  /** Compact mode, haptics and position, read by the pill presenter. */
  setPillPreferences(preferences: PillOptions): void;
  /** The Day recorder needs the rollover hour to find the current Day on startup. */
  setRecorderRolloverHour(hour: number): void;
  /** The device's language tag (`id-ID`), or null when it cannot be read; used for the System choice. */
  deviceLocale(): string | null;
  /** Texts that native code owns, such as the notification, are re-sent in this language. */
  setLocale(locale: Locale): void;
  /** The Lockout engine reads the Punishments and the rollover hour from here. */
  lockout: { setRules(rules: LockoutRules): void };
}

/**
 * Puts settings into force. Safe to call at startup and after every change. The pill
 * is redrawn last (setPillEnabled always redraws and tells the screens), so it and
 * the Today screen show the new Tier thresholds and preferences straight away.
 */
export function applySettings(settings: Settings, targets: SettingsTargets): void {
  targets.engine.configure({
    rolloverHour: settings.rolloverHour,
    thresholds: settings.thresholds,
  });
  targets.setRecorderRolloverHour(settings.rolloverHour);
  targets.lockout.setRules({ punishments: settings.punishments, rolloverHour: settings.rolloverHour });
  const locale = resolveLocale(settings.language, targets.deviceLocale());
  targets.setLocale(locale);
  targets.setPillPreferences({
    compact: settings.compactMode,
    haptics: settings.haptics,
    positionDp: settings.positionDp,
    locale,
  });
  targets.runner.setPillEnabled(settings.overlayEnabled);
}
