import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { Icon } from '../Icon';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function Dot({ filled }: { filled: boolean }) {
  const t = useTheme();
  const s = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(filled ? 1 : 0, { damping: 12, stiffness: 320 });
  }, [filled, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.75 + s.value * 0.35 }] }));
  return (
    <Animated.View
      style={[
        styles.dot,
        { borderColor: t.accent, backgroundColor: filled ? t.accent : 'transparent' },
        style,
      ]}
    />
  );
}

function Key({ k, onPress, disabled }: { k: string; onPress: (k: string) => void; disabled: boolean }) {
  const t = useTheme();
  if (!k) return <View style={styles.key} />;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress(k);
      }}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', borderless: true, radius: 38 }}
      style={[styles.key, k !== 'del' && { backgroundColor: t.dark ? '#22242B' : '#FFFFFF' }, disabled && { opacity: 0.4 }]}
      accessibilityLabel={k === 'del' ? 'Effacer' : k}
    >
      {k === 'del' ? <Icon name="chevronLeft" size={28} color={t.text} strokeWidth={2} /> : <Text style={[styles.keyText, { color: t.text }]}>{k}</Text>}
    </Pressable>
  );
}

/** Numeric keypad with animated dots; shakes on error. */
export function PinPad({
  length,
  value,
  onChange,
  error,
  disabled,
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  error: number;
  disabled?: boolean;
}) {
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!error) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    shake.value = withSequence(
      withTiming(-14, { duration: 50 }),
      withTiming(14, { duration: 60 }),
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(0, { duration: 50 })
    );
  }, [error, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const press = (k: string) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    if (value.length < length) onChange(value + k);
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[styles.dots, shakeStyle]}>
        {Array.from({ length }, (_, i) => (
          <Dot key={i} filled={i < value.length} />
        ))}
      </Animated.View>
      <View style={styles.grid}>
        {KEYS.map((k, i) => (
          <Key key={`${k}-${i}`} k={k} onPress={press} disabled={!!disabled} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 18, height: 30, alignItems: 'center', marginBottom: 34 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  grid: { width: 300, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  key: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 30, fontWeight: '500' },
});
