import React, { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { PlayerPalette } from '../../lib/palette';
import { useTheme } from '../../theme';

type BlobSpec = {
  id: string;
  color: string;
  cx: number; // centre, fraction of width
  cy: number; // centre, fraction of height
  rx: number; // radius, fraction of width
  ry: number; // radius, fraction of height
  ax: number; // horizontal drift, fraction of width
  ay: number; // vertical drift, fraction of height
  fx: number; // whole cycles per loop (keeps the loop seamless)
  fy: number;
  phase: number;
  breathe: number; // scale amplitude
  opacity: number;
};

/** One soft radial glow, stretched to an ellipse and moved with transforms only. */
const Blob = memo(function Blob({ spec, clock, w, h }: { spec: BlobSpec; clock: SharedValue<number>; w: number; h: number }) {
  const rx = spec.rx * w;
  const ry = spec.ry * h;
  const style = useAnimatedStyle(() => {
    const a = 2 * Math.PI * clock.value;
    return {
      transform: [
        { translateX: Math.sin(a * spec.fx + spec.phase) * spec.ax * w },
        { translateY: Math.cos(a * spec.fy + spec.phase * 1.3) * spec.ay * h },
        { scale: 1 + Math.sin(a * spec.fy + spec.phase * 0.7) * spec.breathe },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[
        { position: 'absolute', left: spec.cx * w - rx, top: spec.cy * h - ry, width: rx * 2, height: ry * 2, opacity: spec.opacity },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={spec.id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={spec.color} stopOpacity={1} />
            <Stop offset="0.45" stopColor={spec.color} stopOpacity={0.78} />
            <Stop offset="0.75" stopColor={spec.color} stopOpacity={0.3} />
            <Stop offset="1" stopColor={spec.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${spec.id})`} />
      </Svg>
    </Animated.View>
  );
});

function specs(p: PlayerPalette): BlobSpec[] {
  return [
    // wide glow from the bottom-left, the main colour
    { id: 'ba', color: p.a, cx: 0.08, cy: 0.98, rx: 1.0, ry: 0.42, ax: 0.2, ay: 0.06, fx: 1, fy: 1, phase: 0, breathe: 0.1, opacity: 1 },
    // second colour rising from the bottom-right
    { id: 'bb', color: p.b, cx: 1.0, cy: 0.88, rx: 0.85, ry: 0.34, ax: 0.18, ay: 0.08, fx: 1, fy: 2, phase: 2.1, breathe: 0.12, opacity: 0.95 },
    // soft wash in the middle that drifts across and keeps the motion visible
    { id: 'bc', color: p.a, cx: 0.55, cy: 0.66, rx: 0.75, ry: 0.22, ax: 0.26, ay: 0.07, fx: 2, fy: 1, phase: 4.2, breathe: 0.15, opacity: 0.55 },
    // small highlight of the second colour wandering lower left
    { id: 'bd', color: p.b, cx: 0.3, cy: 0.82, rx: 0.5, ry: 0.18, ax: 0.3, ay: 0.06, fx: 1, fy: 2, phase: 1.1, breathe: 0.18, opacity: 0.6 },
  ];
}

const Layer = memo(function Layer({ palette, clock }: { palette: PlayerPalette; clock: SharedValue<number> }) {
  const { width: w, height: h } = useWindowDimensions();
  return (
    <>
      {specs(palette).map((s) => (
        <Blob key={s.id} spec={s} clock={clock} w={w} h={h} />
      ))}
    </>
  );
});

const LOOP_MS = 14000;

/**
 * Animated mesh-like backdrop: coloured glows drift and breathe while music plays and
 * freeze in place when paused. New colours cross-fade in when the track changes.
 */
export const Backdrop = memo(function Backdrop({ palette, playing }: { palette: PlayerPalette; playing: boolean }) {
  const t = useTheme();
  const base = t.dark ? '#141519' : '#FBFBFC';
  const clock = useSharedValue(0);

  useEffect(() => {
    if (playing) {
      const start = clock.value % 1;
      clock.value = start;
      clock.value = withRepeat(
        withTiming(start + 1, { duration: LOOP_MS, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      // Ease to a stop instead of freezing abruptly.
      const v = clock.value;
      cancelAnimation(clock);
      clock.value = withTiming(v + 0.04, { duration: 900, easing: Easing.out(Easing.cubic) });
    }
  }, [playing, clock]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]}>
      <Animated.View
        key={`${palette.a}-${palette.b}-${t.dark}`}
        entering={FadeIn.duration(700)}
        exiting={FadeOut.duration(700)}
        style={[StyleSheet.absoluteFill, { opacity: t.dark ? 0.82 : 1 }]}
      >
        <Layer palette={palette} clock={clock} />
      </Animated.View>
    </View>
  );
});
