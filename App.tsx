import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors } from './src/design/tokens';
import { useSafeAreaPadding } from './src/design/useSafeAreaPadding';
import { detectionNative } from './src/detection/detectionBridge';
import { LocaleContext, useLocale, useResolvedLocale } from './src/i18n/LocaleContext';
import { t } from './src/i18n/translate';
import { debugClock, getDetectionRunner, whenRestored } from './src/detection/runtime';
import { overlay } from './src/overlay/overlayBridge';
import { pillViewModelFor } from './src/overlay/pillViewModel';
import { createSimulator } from './src/overlay/simulator';
import { BottomNav } from './src/history/BottomNav';
import { HistoryScreen } from './src/history/HistoryScreen';
import { useLockoutStatus } from './src/lockout/useLockoutStatus';
import { settingsStore } from './src/settings/deviceSettings';
import { useSettings } from './src/settings/useSettings';
import { SettingsScreen } from './src/settings/SettingsScreen';
import { TodayScreen } from './src/today/TodayScreen';
import { ToastHost, toasts } from './src/toast/Toast';
import { saveToastFor } from './src/toast/saveToast';
import { OnboardingScreen } from './src/onboarding/OnboardingScreen';
import { useOnboardingGate } from './src/onboarding/useOnboardingGate';
import { PermissionBanner } from './src/permissions/PermissionBanner';
import { permissions } from './src/permissions/permissionsBridge';
import { isCounting, notCountingNotice, permissionBanner } from './src/permissions/permissionState';
import { usePermissionStatus } from './src/permissions/usePermissionStatus';

const NAV_KEYS = ['today', 'history', 'settings'] as const;
type ScreenKey = (typeof NAV_KEYS)[number];

/** The bottom bar sits under the scroll area and handles the bottom inset itself. */
const SCREEN_PADDING = { top: 24, bottom: 24, horizontal: 16 };

function Button({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && styles.buttonPressed,
      ]}>
      <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

function Main() {
  const locale = useLocale();
  const navItems = NAV_KEYS.map((key) => ({ key, label: t(locale, `nav.${key}`) }));
  // Edge to edge: keep content clear of the status bar, cutout and gesture bar (MASTER 8).
  // The bottom bar below the scroll area owns the bottom inset, so only the sides and top here.
  const screenPadding = useSafeAreaPadding(SCREEN_PADDING, false);
  const runner = getDetectionRunner();
  // Debug-only: the simulator skews the shared clock and writes fake Days to History,
  // so it must not exist in a release build.
  const simulator = useRef(__DEV__ ? createSimulator(runner, debugClock) : null).current;
  // Settings are applied to the engine and the pill by the detection runtime; this only shows them.
  const [settings, setSettings] = useState(() => settingsStore.get());
  const lockout = useLockoutStatus();
  const enabled = settings.overlayEnabled;
  const [permitted, setPermitted] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [state, setState] = useState(() => runner.getState());
  const [screen, setScreen] = useState<ScreenKey>('today');

  useEffect(() => {
    setSettings(settingsStore.get());
    return settingsStore.subscribe(setSettings);
  }, []);

  const refreshPermissions = useCallback(async () => {
    setPermitted(await overlay.hasPermission());
    const accessibilityOn = await detectionNative.isAccessibilityEnabled();
    setAccessible(accessibilityOn);
    // The foreground service keeps detection alive once the user has granted access.
    if (accessibilityOn) detectionNative.startForegroundService();
  }, []);

  useEffect(() => {
    refreshPermissions();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPermissions();
    });
    return () => sub.remove();
  }, [refreshPermissions]);

  // Keep the screen in step with the shared engine; the runner drives the pill itself.
  useEffect(() => runner.subscribe(() => setState(runner.getState())), [runner]);

  // Saved counts of today are loaded after startup; show them as soon as they are back.
  useEffect(() => {
    whenRestored().then(() => setState(runner.getState()));
  }, [runner]);

  // First-run gate and permission banner (re-checked whenever the app returns to the foreground).
  const permissionStatus = usePermissionStatus();
  const { gate, complete: completeOnboarding } = useOnboardingGate();
  const banner = permissionBanner(permissionStatus, locale);
  useEffect(() => {
    // A revoked required permission removes the pill; the banner says why.
    if (permissionStatus && !isCounting(permissionStatus)) overlay.hide();
  }, [permissionStatus]);

  const toggleOverlay = () => {
    if (!enabled && !permitted) overlay.requestPermission();
    settingsStore.update({ overlayEnabled: !enabled });
  };

  // The empty-state call to action only ever switches the overlay on.
  const enableOverlay = () => {
    if (!permitted) overlay.requestPermission();
    settingsStore.update({ overlayEnabled: true });
  };

  const fixPermission = (id: 'overlay' | 'accessibility' | 'usageAccess') => {
    if (id === 'overlay') overlay.requestPermission();
    else if (id === 'accessibility') detectionNative.openAccessibilitySettings();
    else permissions.openSettings(id); // same system-settings call as onboarding
  };

  const pill = pillViewModelFor(state);
  const showing = enabled && permitted;

  if (gate === 'loading') return <View style={styles.scroll} />;
  if (gate === 'onboarding') {
    return (
      <OnboardingScreen
        status={permissionStatus}
        onOpenSettings={permissions.openSettings}
        onFinish={completeOnboarding}
      />
    );
  }

  const nav = <BottomNav items={navItems} active={screen} onSelect={setScreen} />;

  if (screen === 'history') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <HistoryScreen state={state} />
        {nav}
      </View>
    );
  }

  return (
    <View style={styles.root}>
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, screenPadding]}>
      <StatusBar barStyle="light-content" />
      {banner !== null && <PermissionBanner banner={banner} onFix={permissions.openSettings} />}
      {screen === 'settings' ? (
        <SettingsScreen
          settings={settings}
          onUpdate={async (patch) => {
            const result = await settingsStore.update(patch);
            const toast = saveToastFor(patch, result);
            if (toast !== null) toasts.show(toast);
            return result;
          }}
          overlayGranted={permitted}
          accessibilityOn={accessible}
          usageAccessGranted={permissionStatus?.usageAccess ?? false}
          onFixPermission={fixPermission}
          lockout={lockout}
        />
      ) : (
        <>
      <TodayScreen
        state={state}
        overlayActive={showing}
        onEnableOverlay={enableOverlay}
        notCountingNotice={notCountingNotice(permissionStatus, locale)}
        usageAccess={permissionStatus?.usageAccess ?? false}
      />

      <Text style={styles.sectionTitle}>{t(locale, 'today.setupTitle')}</Text>

      <Text style={styles.body}>
        {t(locale, accessible ? 'today.detectionOn' : 'today.detectionOff')}
      </Text>
      {!accessible && (
        <View style={styles.row}>
          <Button
            primary
            label={t(locale, 'today.openAccessibility')}
            onPress={() => detectionNative.openAccessibilitySettings()}
          />
        </View>
      )}

      <Text style={styles.body}>
        {t(
          locale,
          showing ? 'today.overlayOn' : enabled ? 'today.overlayNoPermission' : 'today.overlayOff',
        )}
      </Text>
      <View style={styles.row}>
        <Button
          primary={accessible}
          label={t(locale, enabled ? 'today.disableOverlay' : 'today.enableOverlay')}
          onPress={toggleOverlay}
        />
      </View>

      {__DEV__ && simulator !== null && (
        <>
          <Text style={styles.sectionTitle}>Debug: simulate scrolling</Text>
          <Text style={styles.body}>
            {`${pill.countText} ${pill.unitText} · ${pill.timeText} · ${pill.labelText}`}
          </Text>
          <View style={styles.row}>
            <Button label="+1 video" onPress={() => simulator.addVideos(1)} />
            <Button label="+10 videos" onPress={() => simulator.addVideos(10)} />
          </View>
          <View style={styles.row}>
            <Button label="+5 min" onPress={() => simulator.addMinutes(5)} />
            <Button label="+30 min" onPress={() => simulator.addMinutes(30)} />
          </View>
          <View style={styles.row}>
            <Button label="End simulated session" onPress={() => simulator.stop()} />
          </View>
        </>
      )}
        </>
      )}
    </ScrollView>
    <ToastHost />
    {nav}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  container: {
    gap: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: 24,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: colors.action,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLabelPrimary: {
    color: colors.onAction,
  },
});

/** The language is chosen in Settings, so the root reads it and hands it to every screen. */
function App() {
  const locale = useResolvedLocale(useSettings().language);
  return (
    <LocaleContext.Provider value={locale}>
      <Main />
    </LocaleContext.Provider>
  );
}

export default App;
