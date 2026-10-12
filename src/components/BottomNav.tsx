import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Section } from '../store/media';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { haptic } from './ui';

/** Height of the floating bar plus its bottom margin, for content padding. */
export const NAV_HEIGHT = 84;

const ITEMS: { key: Section; label: string; icon: IconName }[] = [
  { key: 'videos', label: 'Vidéos', icon: 'video' },
  { key: 'music', label: 'Musique', icon: 'note' },
  { key: 'docs', label: 'Documents', icon: 'doc' },
  { key: 'settings', label: 'Paramètres', icon: 'settings' },
];

function NavItem({ item, active, onPress }: { item: (typeof ITEMS)[number]; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(active ? 1 : 0, { damping: 20, stiffness: 260, mass: 0.7 });
  }, [active, p]);
  const pill = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.86 + p.value * 0.14 }] }));
  const label = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [t.textSecondary, t.navActive]) }));
  return (
    <Pressable
      onPress={() => {
        if (!active) haptic();
        onPress();
      }}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
    >
      <Animated.View style={[styles.pill, { backgroundColor: t.navPill }, pill]} />
      <Icon name={item.icon} size={23} color={active ? t.navActive : t.textSecondary} strokeWidth={active ? 2.1 : 1.7} />
      <Animated.Text numberOfLines={1} style={[styles.label, label]}>
        {item.label}
      </Animated.Text>
    </Pressable>
  );
}

/** Floating rounded navigation bar. */
export function BottomNav({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
      <View style={[styles.bar, { backgroundColor: t.navBar, shadowColor: t.dark ? '#000' : '#1B2A4A' }]}>
        {ITEMS.map((it) => (
          <NavItem key={it.key} item={it} active={section === it.key} onPress={() => onChange(it.key)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    height: 70,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    elevation: 14,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  item: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, left: 2, right: 2, bottom: 0, borderRadius: 30 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
