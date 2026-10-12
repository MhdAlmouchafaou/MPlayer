import React, { useCallback, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

type Props = {
  labels: string[];
  /** Continuous pager position (page index + scroll offset), driven on the UI thread. */
  position: SharedValue<number>;
  onPress: (index: number) => void;
};

const ACTIVE = 28;
const INACTIVE = 16.5;
const RATIO = INACTIVE / ACTIVE;
const PAD = 14;
const HEIGHT = 58;

/**
 * One UI tab strip. Every tab is laid out once at the large size; the scale, colour and
 * horizontal position are computed per frame from the pager position, entirely with
 * transforms, so following a swipe never triggers a layout pass.
 */
export function TabsHeader({ labels, position, onPress }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // Natural width of each label at the large size, measured once.
  // Start from an estimate so every tab is visible on the first frame, then refine.
  const measured = useRef<number[]>(labels.map((l) => l.length * ACTIVE * 0.52));
  const widths = useSharedValue<number[]>(measured.current);
  const onMeasure = useCallback(
    (index: number, w: number) => {
      // Each tab reports its own width; the full array is rebuilt from the JS copy so
      // concurrent reports never overwrite each other.
      if (Math.abs((measured.current[index] ?? 0) - w) < 0.5) return;
      measured.current = measured.current.map((v, i) => (i === index ? w : v));
      widths.value = measured.current;
    },
    [widths]
  );

  return (
    <View style={styles.wrap}>
      {labels.map((label, i) => (
        <Tab
          key={label}
          label={label}
          index={i}
          count={labels.length}
          screenWidth={width}
          position={position}
          widths={widths}
          onMeasure={onMeasure}
          active={t.tabActive}
          inactive={t.tabInactive}
          onPress={() => onPress(i)}
        />
      ))}
    </View>
  );
}

function Tab({
  label,
  index,
  count,
  screenWidth,
  position,
  widths,
  onMeasure,
  active,
  inactive,
  onPress,
}: {
  label: string;
  index: number;
  count: number;
  screenWidth: number;
  position: SharedValue<number>;
  widths: SharedValue<number[]>;
  onMeasure: (index: number, width: number) => void;
  active: string;
  inactive: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(count - 1, Math.max(0, position.value));
    const w = widths.value;
    // Visual width of every tab at the current position.
    const scaleOf = (k: number) => 1 - Math.min(1, Math.abs(p - k)) * (1 - RATIO);
    let x = 0;
    let myX = 0;
    const centers: number[] = [];
    for (let k = 0; k < count; k++) {
      const vw = (w[k] || 0) * scaleOf(k) + PAD * 2;
      if (k === index) myX = x;
      centers.push(x + vw / 2);
      x += vw;
    }
    const lo = Math.floor(p);
    const hi = Math.min(count - 1, lo + 1);
    const frac = p - lo;
    const focus = centers[lo] + (centers[hi] - centers[lo]) * frac;
    const s = scaleOf(index);
    const d = Math.min(1, Math.abs(p - index));
    return {
      color: interpolateColor(d, [0, 1], [active, inactive]),
      transform: [{ translateX: screenWidth / 2 - focus + myX + PAD }, { scale: s }],
    };
  });

  return (
    <Animated.Text
        numberOfLines={1}
        onLayout={(e) => onMeasure(index, e.nativeEvent.layout.width)}
        onPress={onPress}
        suppressHighlighting
        style={[styles.label, style]}
      >
        {label}
      </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    left: 0,
    bottom: 2,
    paddingVertical: 8,
    fontSize: ACTIVE,
    includeFontPadding: false,
    letterSpacing: 0.1,
    transformOrigin: 'left bottom',
  },
});
