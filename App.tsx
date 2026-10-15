import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors } from './src/design/tokens';
import { overlay } from './src/overlay/overlayBridge';
import { createPillPresenter, pillViewModelFor } from './src/overlay/pillViewModel';
import { createSimulator } from './src/overlay/simulator';

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
  const simulator = useRef(createSimulator()).current;
  const presenter = useRef(createPillPresenter());
  const [enabled, setEnabled] = useState(false);
  const [permitted, setPermitted] = useState(false);
  const [state, setState] = useState(() => simulator.getState());

  const refreshPermission = useCallback(async () => {
    setPermitted(await overlay.hasPermission());
  }, []);

  useEffect(() => {
    refreshPermission();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  // Push the engine state to the native pill whenever it, or its visibility, changes.
  useEffect(() => {
    if (enabled && permitted) {
      overlay.render(presenter.current(state));
    } else {
      overlay.hide();
      // A fresh presenter, so showing the pill again never replays a Tier change.
      presenter.current = createPillPresenter();
    }
  }, [enabled, permitted, state]);

  const toggleOverlay = () => {
    if (!enabled && !permitted) overlay.requestPermission();
    setEnabled(!enabled);
  };

  const addVideos = (n: number) => {
    simulator.addVideos(n);
    setState(simulator.getState());
  };
  const addMinutes = (n: number) => {
    simulator.addMinutes(n);
    setState(simulator.getState());
  };

  const pill = pillViewModelFor(state);
  const showing = enabled && permitted;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>DoomMeter</Text>

      <Text style={styles.body}>
        {showing
          ? 'Overlay is on. Open another app to see the pill over it.'
          : enabled
            ? 'Overlay permission is missing. Grant "Display over other apps", then come back.'
            : 'Overlay is off.'}
      </Text>
      <Button
        primary
        label={enabled ? 'Disable overlay' : 'Enable overlay'}
        onPress={toggleOverlay}
      />

      <Text style={styles.sectionTitle}>Debug: simulate scrolling</Text>
      <Text style={styles.body}>
        {`${pill.countText} ${pill.unitText} · ${pill.timeText} · ${pill.labelText}`}
      </Text>
      <View style={styles.row}>
        <Button label="+1 video" onPress={() => addVideos(1)} />
        <Button label="+10 videos" onPress={() => addVideos(10)} />
      </View>
      <View style={styles.row}>
        <Button label="+5 min" onPress={() => addMinutes(5)} />
        <Button label="+30 min" onPress={() => addMinutes(30)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
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
