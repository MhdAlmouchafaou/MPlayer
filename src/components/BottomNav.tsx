import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Section } from '../store/media';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { haptic } from './ui';

export const NAV_HEIGHT = 66;

const ITEMS: { key: Section; label: string; icon: IconName }[] = [
  { key: 'videos', label: 'Vidéos', icon: 'video' },
  { key: 'music', label: 'Musique', icon: 'note' },
  { key: 'docs', label: 'Documents', icon: 'doc' },
];

function NavItem({ item, active, onPress }: { item: (typeof ITEMS)[number]; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [active, p]);
  const pill = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scaleX: 0.6 + p.value * 0.4 }],
  }));
  const label = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [t.textSecondary, t.tabActive]),
  }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(active ? -1 : 0) }, { scale: 1 + p.value * 0.06 }] }));
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: t.dark ? 'rgba(126,166,245,0.18)' : 'rgba(17,69,125,0.10)' }, pill]} />
        <Animated.View style={icon}>
          <Icon name={item.icon} size={24} color={active ? t.tabActive : t.textSecondary} strokeWidth={active ? 2 : 1.7} />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.label, label]}>{item.label}</Animated.Text>
    </Pressable>
  );
}

export function BottomNav({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: NAV_HEIGHT + insets.bottom, backgroundColor: t.surface, borderTopColor: t.divider }]}>
      {ITEMS.map((it) => (
        <NavItem key={it.key} item={it} active={section === it.key} onPress={() => onChange(it.key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  iconWrap: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  label: { fontSize: 12.5, fontWeight: '600', marginTop: 3 },
});
