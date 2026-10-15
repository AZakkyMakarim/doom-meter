import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';
import type { PermissionBanner as PermissionBannerModel, PermissionId } from './permissionState';

export interface PermissionBannerProps {
  banner: PermissionBannerModel;
  onFix: (permission: PermissionId) => void;
}

/** In-app banner shown while a required permission is off (MASTER 6.5): says it is not counting. */
export function PermissionBanner({ banner, onFix }: PermissionBannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{banner.message}</Text>
      {banner.fixes.map((fix) => (
        <Pressable
          key={fix.permission}
          accessibilityRole="button"
          accessibilityLabel={fix.accessibilityLabel}
          onPress={() => onFix(fix.permission)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>{fix.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.sev[2],
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  message: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.action,
  },
  buttonLabel: {
    color: colors.onAction,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
