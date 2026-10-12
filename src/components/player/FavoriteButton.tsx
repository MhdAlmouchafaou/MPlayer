import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '../Icon';
import { haptic } from '../ui';

const SIZE = 28;
const PARTICLES = 8;

function Particle({ i, burst, color }: { i: number; burst: SharedValue<number>; color: string }) {
  const angle = (i / PARTICLES) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => {
    const p = burst.value;
    const dist = 10 + p * 22;
    return {
      opacity: p > 0 && p < 1 ? 1 - p : 0,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: 1 - p * 0.6 },
      ],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color, width: i % 2 ? 5 : 7, height: i % 2 ? 5 : 7 }, style]} />;
}

/** Heart that pops, fills and bursts when a track is added to favourites. */
export function FavoriteButton({ active, onToggle, color = '#fff' }: { active: boolean; onToggle: () => void; color?: string }) {
  const scale = useSharedValue(1);
  const fill = useSharedValue(active ? 1 : 0);
  const ring = useSharedValue(0);
  const burst = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      fill.value = active ? 1 : 0;
      return;
    }
    if (active) {
      fill.value = withTiming(1, { duration: 160 });
      scale.value = withSequence(
        withTiming(0.72, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(1.28, { damping: 6, stiffness: 420, mass: 0.6 }),
        withSpring(1, { damping: 10, stiffness: 260 })
      );
      ring.value = 0;
      ring.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
      burst.value = 0;
      burst.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    } else {
      fill.value = withTiming(0, { duration: 180 });
      scale.value = withSequence(withTiming(0.8, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 300 }));
    }
  }, [active, fill, scale, ring, burst]);

  const heart = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const filled = useAnimatedStyle(() => ({ opacity: fill.value }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? (1 - ring.value) * 0.9 : 0,
    transform: [{ scale: 0.4 + ring.value * 1.3 }],
    borderWidth: 3 * (1 - ring.value) + 0.5,
  }));

  return (
    <Pressable
      onPress={() => {
        haptic();
        onToggle();
      }}
      hitSlop={10}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, ringStyle]} />
      {Array.from({ length: PARTICLES }, (_, i) => (
        <Particle key={i} i={i} burst={burst} color={color} />
      ))}
      <Animated.View style={heart}>
        <View>
          <Animated.View style={outline}>
            <Icon name="heart" size={SIZE} color={color} strokeWidth={1.8} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, filled]}>
            <Icon name="heartFilled" size={SIZE} color={color} strokeWidth={1.8} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  particle: {
    position: 'absolute',
    borderRadius: 4,
  },
});
