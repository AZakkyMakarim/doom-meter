import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors } from '../design/tokens';
import type { Settings, SettingsPatch, SettingsResult } from './settings';
import {
  draftsFor,
  parseRolloverDraft,
  parseThresholdDrafts,
  permissionRows,
  positionControl,
  rolloverLabel,
} from './settingsViewModel';
import type { PermissionRow, SettingsDrafts } from './settingsViewModel';

export interface SettingsScreenProps {
  settings: Settings;
  /** Validates, applies and saves a change; resolves with the reason when it is refused. */
  onUpdate: (patch: SettingsPatch) => Promise<SettingsResult>;
  overlayGranted: boolean;
  accessibilityOn: boolean;
  /** Opens the system screen where the missing permission can be granted. */
  onFixPermission: (id: PermissionRow['id']) => void;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.body}>{label}</Text>
        {hint !== undefined && <Text style={styles.caption}>{hint}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.sev[0] }}
        thumbColor={colors.text}
      />
    </View>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.buttonSecondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}>
      <Text style={[styles.buttonLabel, styles.buttonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

function ErrorText({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
      {`Error: ${message}`}
    </Text>
  );
}

function PermissionBlock({
  row,
  primary,
  onFix,
}: {
  row: PermissionRow;
  /** One primary action per screen: only the first missing permission gets it. */
  primary: boolean;
  onFix: (id: PermissionRow['id']) => void;
}) {
  return (
    <View style={styles.permission}>
      <View style={styles.permissionHeader} accessible accessibilityLabel={row.accessibilityLabel}>
        <Text style={styles.body}>{row.title}</Text>
        <View style={[styles.chip, row.granted ? styles.chipOk : styles.chipMissing]}>
          <Text style={styles.chipText}>{row.statusText}</Text>
        </View>
      </View>
      {!row.granted && <Text style={styles.caption}>{row.explanation}</Text>}
      {row.fixLabel !== null &&
        (primary ? (
          <PrimaryButton label={row.fixLabel} onPress={() => onFix(row.id)} />
        ) : (
          <SecondaryButton label={row.fixLabel} onPress={() => onFix(row.id)} />
        ))}
    </View>
  );
}

/** Settings (MASTER.md 6.4): permissions, overlay, Tier thresholds, Day rollover. */
export function SettingsScreen({
  settings,
  onUpdate,
  overlayGranted,
  accessibilityOn,
  onFixPermission,
}: SettingsScreenProps) {
  const [drafts, setDrafts] = useState<SettingsDrafts>(() => draftsFor(settings));
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [rolloverError, setRolloverError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Show the saved values again whenever they change (a save, or a drag of the pill).
  const thresholdsKey = JSON.stringify(settings.thresholds);
  useEffect(() => {
    setDrafts((d) => ({ ...d, thresholds: draftsFor(settings).thresholds }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdsKey]);
  useEffect(() => {
    setDrafts((d) => ({ ...d, rolloverHour: String(settings.rolloverHour) }));
  }, [settings.rolloverHour]);

  async function change(patch: SettingsPatch) {
    const result = await onUpdate(patch);
    setSaveError(result.ok ? null : result.error);
  }

  async function saveThresholds() {
    const parsed = parseThresholdDrafts(drafts.thresholds);
    if (!parsed.ok) return setThresholdError(parsed.error);
    const result = await onUpdate({ thresholds: parsed.value });
    setThresholdError(result.ok ? null : result.error);
  }

  async function saveRollover() {
    const parsed = parseRolloverDraft(drafts.rolloverHour);
    if (!parsed.ok) return setRolloverError(parsed.error);
    const result = await onUpdate({ rolloverHour: parsed.value });
    setRolloverError(result.ok ? null : result.error);
  }

  const position = positionControl(settings.positionDp);
  const permissions = permissionRows({ overlayGranted, accessibilityOn });
  const firstMissing = permissions.find((row) => !row.granted)?.id;

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Settings
      </Text>

      <Card title="Permissions">
        {permissions.map((row) => (
          <PermissionBlock
            key={row.id}
            row={row}
            primary={row.id === firstMissing}
            onFix={onFixPermission}
          />
        ))}
      </Card>

      <Card title="Overlay">
        <ToggleRow
          label="Show overlay pill"
          hint="Appears only while a short-form feed is open."
          value={settings.overlayEnabled}
          onChange={(overlayEnabled) => change({ overlayEnabled })}
        />
        <ToggleRow
          label="Compact mode"
          hint="Face and count only."
          value={settings.compactMode}
          onChange={(compactMode) => change({ compactMode })}
        />
        <ToggleRow
          label="Haptics"
          hint="A vibration when your Tier goes up."
          value={settings.haptics}
          onChange={(haptics) => change({ haptics })}
        />
        <View style={styles.positionBlock}>
          <Text style={styles.body}>Position</Text>
          <Text style={styles.caption}>You can also drag the pill itself.</Text>
          <View style={styles.positionRow}>
            <SecondaryButton
              label="Move up"
              disabled={!position.canMoveUp}
              onPress={() => change({ positionDp: position.nextUp })}
            />
            <Text style={styles.positionValue} accessibilityLiveRegion="polite">
              {position.valueText}
            </Text>
            <SecondaryButton
              label="Move down"
              disabled={!position.canMoveDown}
              onPress={() => change({ positionDp: position.nextDown })}
            />
          </View>
        </View>
        <ErrorText message={saveError} />
      </Card>

      <Card title="Tier thresholds">
        <Text style={styles.caption}>
          Each Tier starts at the numbers below. Your Tier is the higher of the videos Tier and
          the minutes Tier. Numbers must go up from one Tier to the next.
        </Text>
        {drafts.thresholds.map((row, i) => (
          <View key={row.tierName} style={styles.thresholdRow}>
            <View style={styles.tierName}>
              <View style={[styles.tierDot, { backgroundColor: colors.sev[i + 1] }]} />
              <Text style={styles.body}>{row.tierName}</Text>
            </View>
            <NumberField
              label={`${row.tierName} videos`}
              caption="Videos"
              value={row.videos}
              onChange={(videos) =>
                setDrafts((d) => ({
                  ...d,
                  thresholds: d.thresholds.map((r, j) => (j === i ? { ...r, videos } : r)),
                }))
              }
            />
            <NumberField
              label={`${row.tierName} minutes`}
              caption="Minutes"
              value={row.minutes}
              onChange={(minutes) =>
                setDrafts((d) => ({
                  ...d,
                  thresholds: d.thresholds.map((r, j) => (j === i ? { ...r, minutes } : r)),
                }))
              }
            />
          </View>
        ))}
        <ErrorText message={thresholdError} />
        <SecondaryButton label="Save thresholds" onPress={saveThresholds} />
      </Card>

      <Card title="Day">
        <Text style={styles.caption}>
          {`A new Day starts at ${rolloverLabel(settings.rolloverHour)} local time, so late-night scrolling stays in the same Day. Enter an hour from 0 to 23.`}
        </Text>
        <View style={styles.rolloverRow}>
          <NumberField
            label="Day rollover hour"
            caption="Hour (0-23)"
            value={drafts.rolloverHour}
            onChange={(rolloverHour) => setDrafts((d) => ({ ...d, rolloverHour }))}
          />
        </View>
        <ErrorText message={rolloverError} />
        <SecondaryButton label="Save rollover hour" onPress={saveRollover} />
      </Card>
    </View>
  );
}

function NumberField({
  label,
  caption,
  value,
  onChange,
}: {
  label: string;
  caption: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.caption}>{caption}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
        maxLength={4}
        selectTextOnFocus
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const MONO_MEDIUM = 'JetBrainsMono-Medium';

const styles = StyleSheet.create({
  screen: {
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: colors.sev[3],
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    gap: 12,
  },
  toggleText: {
    flexShrink: 1,
    gap: 2,
  },
  permission: {
    gap: 8,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipOk: {
    backgroundColor: colors.sev[0],
  },
  chipMissing: {
    backgroundColor: colors.sev[2],
  },
  chipText: {
    color: colors.onSev,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  positionBlock: {
    gap: 8,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionValue: {
    flex: 1,
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 104,
    minHeight: 48,
  },
  tierDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rolloverRow: {
    flexDirection: 'row',
  },
  field: {
    gap: 4,
    minWidth: 88,
    flex: 1,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.appBg,
    color: colors.text,
    fontFamily: MONO_MEDIUM,
    fontSize: 16,
    paddingHorizontal: 12,
    fontVariant: ['tabular-nums'],
  },
  button: {
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
    backgroundColor: colors.overlayBgAlt,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLabelPrimary: {
    color: colors.onAction,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
