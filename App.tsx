import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors } from './src/design/tokens';
import { detectionNative } from './src/detection/detectionBridge';
import { debugClock, getDetectionRunner, whenRestored } from './src/detection/runtime';
import { overlay } from './src/overlay/overlayBridge';
import { pillViewModelFor } from './src/overlay/pillViewModel';
import { createSimulator } from './src/overlay/simulator';
import { TodayScreen } from './src/today/TodayScreen';

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
  const [enabled, setEnabled] = useState(true);
  const [permitted, setPermitted] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [state, setState] = useState(() => runner.getState());

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

  const toggleOverlay = () => {
    if (!enabled && !permitted) overlay.requestPermission();
    runner.setPillEnabled(!enabled);
    setEnabled(!enabled);
  };

  // The empty-state call to action only ever switches the overlay on.
  const enableOverlay = () => {
    if (!permitted) overlay.requestPermission();
    runner.setPillEnabled(true);
    setEnabled(true);
  };

  const pill = pillViewModelFor(state);
  const showing = enabled && permitted;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <StatusBar barStyle="light-content" />
      <TodayScreen state={state} overlayActive={showing} onEnableOverlay={enableOverlay} />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
