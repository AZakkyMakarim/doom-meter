import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors } from './src/design/tokens';
import { detectionNative } from './src/detection/detectionBridge';
import { debugClock, getDetectionRunner, whenRestored } from './src/detection/runtime';
import { overlay } from './src/overlay/overlayBridge';
import { pillViewModelFor } from './src/overlay/pillViewModel';
import { createSimulator } from './src/overlay/simulator';
import { BottomNav } from './src/history/BottomNav';
import { HistoryScreen } from './src/history/HistoryScreen';
import { settingsStore } from './src/settings/deviceSettings';
import { SettingsScreen } from './src/settings/SettingsScreen';
import { TodayScreen } from './src/today/TodayScreen';
import { OnboardingScreen } from './src/onboarding/OnboardingScreen';
import { useOnboardingGate } from './src/onboarding/useOnboardingGate';
import { PermissionBanner } from './src/permissions/PermissionBanner';
import { permissions } from './src/permissions/permissionsBridge';
import { isCounting, notCountingNotice, permissionBanner } from './src/permissions/permissionState';
import { usePermissionStatus } from './src/permissions/usePermissionStatus';

const NAV_ITEMS = [
  { key: 'today', label: 'Today' },
  { key: 'history', label: 'History' },
  { key: 'settings', label: 'Settings' },
] as const;
type ScreenKey = (typeof NAV_ITEMS)[number]['key'];

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

function App() {
  const runner = getDetectionRunner();
  const simulator = useRef(createSimulator(runner, debugClock)).current;
  // Settings are applied to the engine and the pill by the detection runtime; this only shows them.
  const [settings, setSettings] = useState(() => settingsStore.get());
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
  const banner = permissionBanner(permissionStatus);
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

  const fixPermission = (id: 'overlay' | 'accessibility') => {
    if (id === 'overlay') overlay.requestPermission();
    else detectionNative.openAccessibilitySettings();
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

  const nav = <BottomNav items={NAV_ITEMS} active={screen} onSelect={setScreen} />;

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <StatusBar barStyle="light-content" />
      {banner !== null && <PermissionBanner banner={banner} onFix={permissions.openSettings} />}
      {screen === 'settings' ? (
        <SettingsScreen
          settings={settings}
          onUpdate={(patch) => settingsStore.update(patch)}
          overlayGranted={permitted}
          accessibilityOn={accessible}
          onFixPermission={fixPermission}
        />
      ) : (
        <>
      <TodayScreen
        state={state}
        overlayActive={showing}
        onEnableOverlay={enableOverlay}
        notCountingNotice={notCountingNotice(permissionStatus)}
        usageAccess={permissionStatus?.usageAccess ?? false}
      />

      <Text style={styles.sectionTitle}>Setup</Text>

      <Text style={styles.body}>
        {accessible
          ? 'Detection is on. Scroll TikTok and the pill follows along.'
          : 'Detection is off. Enable the DoomMeter Accessibility service so it can see when you scroll short videos. Only counts are kept; no video content is read or stored.'}
      </Text>
      {!accessible && (
        <View style={styles.row}>
          <Button
            primary
            label="Open Accessibility settings"
            onPress={() => detectionNative.openAccessibilitySettings()}
          />
        </View>
      )}

      <Text style={styles.body}>
        {showing
          ? 'Overlay is on. It shows only while a short-form feed is open.'
          : enabled
            ? 'Overlay permission is missing. Grant "Display over other apps", then come back.'
            : 'Overlay is off.'}
      </Text>
      <View style={styles.row}>
        <Button
          primary={accessible}
          label={enabled ? 'Disable overlay' : 'Enable overlay'}
          onPress={toggleOverlay}
        />
      </View>

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
    </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
    paddingBottom: 48,
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
    borderColor: colors.border,
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

export default App;
