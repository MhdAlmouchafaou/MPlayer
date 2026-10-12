import * as Haptics from 'expo-haptics';
import React, { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export function haptic() {
  Haptics.selectionAsync().catch(() => {});
}

type TouchableProps = PressableProps & { style?: StyleProp<ViewStyle>; rippleColor?: string; borderless?: boolean };

export function Touchable({ style, rippleColor, borderless, children, ...rest }: TouchableProps) {
  const t = useTheme();
  return (
    <Pressable
      android_ripple={{ color: rippleColor ?? (t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), borderless: !!borderless }}
      style={style}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

type IconButtonProps = {
  name: IconName;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number;
  color?: string;
  hitSize?: number;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
  label?: string;
  disabled?: boolean;
};

export const IconButton = memo(function IconButton({
  name,
  onPress,
  onLongPress,
  size = 24,
  color,
  hitSize = 44,
  style,
  strokeWidth,
  label,
  disabled,
}: IconButtonProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', borderless: true, radius: hitSize / 2 }}
      style={[{ width: hitSize, height: hitSize, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }, style]}
    >
      <Icon name={name} size={size} color={color ?? t.icon} strokeWidth={strokeWidth} />
    </Pressable>
  );
});

/** One UI style switch. */
export function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, p]);
  const offColor = t.dark ? '#8B8D94' : '#6F7176';
  const onColor = t.dark ? '#5D8FE6' : '#6A9DEB';
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [t.dark ? '#2B2C31' : '#FFFFFF', onColor]),
    borderColor: interpolateColor(p.value, [0, 1], [offColor, onColor]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * 20 }],
    borderColor: interpolateColor(p.value, [0, 1], [offColor, onColor]),
  }));
  return (
    <Pressable
      onPress={() => {
        haptic();
        onChange(!value);
      }}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.switchTrack, track]}>
        <Animated.View style={[styles.switchThumb, thumb, { backgroundColor: t.dark ? '#F1F2F5' : '#FFFFFF' }]} />
      </Animated.View>
    </Pressable>
  );
}

type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (v: number) => void;
  onComplete?: (v: number) => void;
  trackHeight?: number;
  trackColor: string;
  fillColor: string;
  thumbColor: string;
  thumbBorderColor?: string;
  thumbSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Gesture-driven slider used for seeking and settings. */
export function Slider({
  value,
  min = 0,
  max = 1,
  step,
  onChange,
  onComplete,
  trackHeight = 4,
  trackColor,
  fillColor,
  thumbColor,
  thumbBorderColor,
  thumbSize = 22,
  style,
}: SliderProps) {
  const width = useSharedValue(0);
  const ratio = useSharedValue(0);
  const dragging = useSharedValue(false);
  const pressed = useSharedValue(0);
  const range = max - min || 1;

  useEffect(() => {
    if (!dragging.value) ratio.value = Math.min(1, Math.max(0, (value - min) / range));
  }, [value, min, range, dragging, ratio]);

  const snap = (r: number) => {
    'worklet';
    let v = min + r * range;
    if (step) v = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, v));
  };

  const emitChange = (v: number) => onChange?.(v);
  const emitComplete = (v: number) => onComplete?.(v);

  const pan = Gesture.Pan()
    .hitSlop({ top: 16, bottom: 16 })
    .activeOffsetX([-3, 3])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      dragging.value = true;
      pressed.value = withTiming(1, { duration: 120 });
      if (width.value > 0) ratio.value = Math.min(1, Math.max(0, e.x / width.value));
    })
    .onUpdate((e) => {
      if (width.value <= 0) return;
      const r = Math.min(1, Math.max(0, e.x / width.value));
      ratio.value = step ? (snap(r) - min) / range : r;
      if (onChange) scheduleOnRN(emitChange, snap(r));
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      pressed.value = withTiming(0, { duration: 160 });
      scheduleOnRN(emitComplete, snap(ratio.value));
    });

  const fill = useAnimatedStyle(() => ({ width: `${ratio.value * 100}%` }));
  const thumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: ratio.value * width.value - thumbSize / 2 },
      { scale: 1 + pressed.value * 0.15 },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[{ height: Math.max(thumbSize, trackHeight) + 16, justifyContent: 'center' }, style]}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
        }}
      >
        <View style={{ height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: trackColor, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', backgroundColor: fillColor, borderRadius: trackHeight / 2 }, fill]} />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbColor,
              borderWidth: thumbBorderColor ? 2.5 : 0,
              borderColor: thumbBorderColor,
              elevation: thumbBorderColor ? 0 : 2,
            },
            thumb,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[styles.sectionLabel, { color: t.tabInactive }]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface }, style]}>{children}</View>;
}

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.divider, marginLeft: inset }, style]} />;
}

export function RoundButton({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true, radius: 24 }}
      style={[styles.round, { backgroundColor: t.chip }]}
    >
      <Icon name={name} size={name === 'play' ? 20 : 22} color={t.text} />
    </Pressable>
  );
}

export function useMounted() {
  const ref = useRef(true);
  useEffect(
    () => () => {
      ref.current = false;
    },
    []
  );
  return ref;
}

const styles = StyleSheet.create({
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 26,
  },
  card: {
    borderRadius: 26,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
