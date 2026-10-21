import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors } from '../design/tokens';
import { LANGUAGE_PREFERENCES } from '../i18n/locale';
import type { LanguagePreference, Locale } from '../i18n/locale';
import { useLocale } from '../i18n/LocaleContext';
import { tierLabel } from '../i18n/text';
import { t } from '../i18n/translate';
import type { MessageRef } from '../i18n/translate';
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
  usageAccessGranted: boolean;
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

function ErrorText({ message, locale }: { message: MessageRef | null; locale: Locale }) {
  if (message === null) return null;
  return (
    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
      {t(locale, 'settings.error', { message })}
    </Text>
  );
}

/** System, English or Bahasa Indonesia: one choice, applied the moment it is tapped. */
function LanguageChoice({
  value,
  locale,
  onChange,
}: {
  value: LanguagePreference;
  locale: Locale;
  onChange: (language: LanguagePreference) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.languageOptions}>
      {LANGUAGE_PREFERENCES.map((option) => {
        const selected = option === value;
        const label = t(locale, `settings.language.${option}`);
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.button,
              styles.buttonSecondary,
              selected && styles.languageSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.buttonLabel, selected && styles.languageSelectedLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
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
        <View style={styles.permissionTitle}>
          <Text style={styles.body}>{row.title}</Text>
          {!row.required && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{row.badge}</Text>
            </View>
          )}
        </View>
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
  usageAccessGranted,
  onFixPermission,
}: SettingsScreenProps) {
  const [drafts, setDrafts] = useState<SettingsDrafts>(() => draftsFor(settings));
  const locale = useLocale();
  const [thresholdError, setThresholdError] = useState<MessageRef | null>(null);
  const [rolloverError, setRolloverError] = useState<MessageRef | null>(null);
  const [saveError, setSaveError] = useState<MessageRef | null>(null);

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
    // Error messages name the Tier in the language shown now.
    const parsed = parseThresholdDrafts(
      drafts.thresholds.map((row, i) => ({ ...row, tierName: tierLabel(i + 1, locale) })),
    );
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

  const position = positionControl(settings.positionDp, locale);
  const permissions = permissionRows({ overlayGranted, accessibilityOn, usageAccessGranted }, locale);
  // The primary action is for a missing required permission; an optional one stays secondary.
  const firstMissing = permissions.find((row) => row.required && !row.granted)?.id;

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {t(locale, 'settings.title')}
      </Text>

      <Card title={t(locale, 'settings.language.title')}>
        <Text style={styles.caption}>{t(locale, 'settings.language.hint')}</Text>
        <LanguageChoice
          value={settings.language}
          locale={locale}
          onChange={(language) => change({ language })}
        />
      </Card>

      <Card title={t(locale, 'settings.permissions.title')}>
        {permissions.map((row) => (
          <PermissionBlock
            key={row.id}
            row={row}
            primary={row.id === firstMissing}
            onFix={onFixPermission}
          />
        ))}
      </Card>

      <Card title={t(locale, 'settings.overlay.title')}>
        <ToggleRow
          label={t(locale, 'settings.overlay.show')}
          hint={t(locale, 'settings.overlay.showHint')}
          value={settings.overlayEnabled}
          onChange={(overlayEnabled) => change({ overlayEnabled })}
        />
        <ToggleRow
          label={t(locale, 'settings.overlay.compact')}
          hint={t(locale, 'settings.overlay.compactHint')}
          value={settings.compactMode}
          onChange={(compactMode) => change({ compactMode })}
        />
        <ToggleRow
          label={t(locale, 'settings.overlay.haptics')}
          hint={t(locale, 'settings.overlay.hapticsHint')}
          value={settings.haptics}
          onChange={(haptics) => change({ haptics })}
        />
        <View style={styles.positionBlock}>
          <Text style={styles.body}>{t(locale, 'settings.position.label')}</Text>
          <Text style={styles.caption}>{t(locale, 'settings.position.hint')}</Text>
          <View style={styles.positionRow}>
            <SecondaryButton
              label={t(locale, 'settings.position.up')}
              disabled={!position.canMoveUp}
              onPress={() => change({ positionDp: position.nextUp })}
            />
            <Text style={styles.positionValue} accessibilityLiveRegion="polite">
              {position.valueText}
            </Text>
            <SecondaryButton
              label={t(locale, 'settings.position.down')}
              disabled={!position.canMoveDown}
              onPress={() => change({ positionDp: position.nextDown })}
            />
          </View>
        </View>
        <ErrorText message={saveError} locale={locale} />
      </Card>

      <Card title={t(locale, 'settings.thresholds.title')}>
        <Text style={styles.caption}>{t(locale, 'settings.thresholds.hint')}</Text>
        {drafts.thresholds.map((row, i) => (
          <View key={i} style={styles.thresholdRow}>
            <View style={styles.tierName}>
              <View style={[styles.tierDot, { backgroundColor: colors.sev[i + 1] }]} />
              <Text style={styles.body}>{tierLabel(i + 1, locale)}</Text>
            </View>
            <NumberField
              label={t(locale, 'settings.thresholds.videosLabel', { tier: tierLabel(i + 1, locale) })}
              caption={t(locale, 'settings.thresholds.videos')}
              value={row.videos}
              onChange={(videos) =>
                setDrafts((d) => ({
                  ...d,
                  thresholds: d.thresholds.map((r, j) => (j === i ? { ...r, videos } : r)),
                }))
              }
            />
            <NumberField
              label={t(locale, 'settings.thresholds.minutesLabel', { tier: tierLabel(i + 1, locale) })}
              caption={t(locale, 'settings.thresholds.minutes')}
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
        <ErrorText message={thresholdError} locale={locale} />
        <SecondaryButton label={t(locale, 'settings.thresholds.save')} onPress={saveThresholds} />
      </Card>

      <Card title={t(locale, 'settings.day.title')}>
        <Text style={styles.caption}>
          {t(locale, 'settings.day.hint', { time: rolloverLabel(settings.rolloverHour) })}
        </Text>
        <View style={styles.rolloverRow}>
          <NumberField
            label={t(locale, 'settings.day.fieldLabel')}
            caption={t(locale, 'settings.day.fieldCaption')}
            value={drafts.rolloverHour}
            onChange={(rolloverHour) => setDrafts((d) => ({ ...d, rolloverHour }))}
          />
        </View>
        <ErrorText message={rolloverError} locale={locale} />
        <SecondaryButton label={t(locale, 'settings.day.save')} onPress={saveRollover} />
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
  permissionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  positionValue: {
    flex: 1,
    minWidth: 72,
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
    borderColor: colors.borderStrong,
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
    borderColor: colors.borderStrong,
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
  languageOptions: {
    gap: 8,
  },
  languageSelected: {
    borderWidth: 2,
    borderColor: colors.action,
  },
  languageSelectedLabel: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
