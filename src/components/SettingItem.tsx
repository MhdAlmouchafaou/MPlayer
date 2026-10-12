import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { IconButton } from './ui';

export function SettingItem({
  title,
  value,
  sub,
  right,
  onPress,
  children,
  last,
  onRef,
}: {
  title: string;
  value?: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  children?: React.ReactNode;
  last?: boolean;
  onRef?: (v: View | null) => void;
}) {
  const t = useTheme();
  return (
    <View ref={onRef} collapsable={false}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        android_ripple={onPress ? { color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' } : undefined}
        style={styles.item}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.text }]}>{title}</Text>
            {value ? <Text style={[styles.value, { color: t.accent }]}>{value}</Text> : null}
            {sub ? <Text style={[styles.sub, { color: t.textSecondary }]}>{sub}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </Pressable>
      {!last ? <View style={[styles.divider, { backgroundColor: t.divider }]} /> : null}
    </View>
  );
}

export function ScreenHeader({ title }: { title: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { marginTop: insets.top }]}>
      <IconButton name="chevronLeft" size={28} color={t.brand} strokeWidth={1.8} label="Retour" onPress={() => router.back()} />
      <Text numberOfLines={1} style={[styles.headerTitle, { color: t.brand }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingHorizontal: 26,
    paddingVertical: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16.5,
  },
  value: {
    fontSize: 14,
    marginTop: 3,
  },
  sub: {
    fontSize: 13,
    marginTop: 3,
  },
  divider: {
    height: 1,
    marginHorizontal: 22,
  },
  header: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 27,
    fontWeight: '600',
    marginLeft: 6,
  },
});
