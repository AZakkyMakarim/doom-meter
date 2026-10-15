import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';

export interface BottomNavItem<Key extends string> {
  key: Key;
  label: string;
}

/**
 * Bottom navigation (MASTER 6.4: 3-4 items). Generic over the screen keys so
 * Settings can add its entry by extending `items`. The active tab is shown by a top
 * bar and bold text as well as colour.
 */
export function BottomNav<Key extends string>({
  items,
  active,
  onSelect,
}: {
  items: readonly BottomNavItem<Key>[];
  active: Key;
  onSelect: (key: Key) => void;
}) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {items.map(item => {
        const selected = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View
              style={[styles.indicator, selected && styles.indicatorActive]}
            />
            <Text style={[styles.label, selected && styles.labelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.overlayBgAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    // Edge-to-edge: leave room for the system gesture bar.
    paddingBottom: 24,
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.text,
  },
  label: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
