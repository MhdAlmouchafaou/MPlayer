import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme';
import { ALPHABET } from '../utils';
import { haptic } from './ui';

type Props = {
  available: Set<string>;
  onSelect: (letter: string) => void;
  top?: number;
  bottom?: number;
};

const BUBBLE = 68;

function Letter({ letter, index, active, has, color, activeColor, mutedColor }: {
  letter: string;
  index: number;
  active: SharedValue<number>;
  has: boolean;
  color: string;
  activeColor: string;
  mutedColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const on = active.value === index ? 1 : 0;
    return {
      color: interpolateColor(on, [0, 1], [has ? color : mutedColor, activeColor]),
      transform: [{ scale: withTiming(on ? 1.35 : 1, { duration: 120 }) }],
    };
  });
  return <Animated.Text style={[styles.letter, style]}>{letter}</Animated.Text>;
}

/**
 * Fast scroller on the right edge. Touch or drag anywhere on it: the gesture runs on the
 * UI thread, a bubble follows the finger and the list jumps to the letter under it.
 */
export function AlphabetScroller({ available, onSelect, top = 12, bottom = 12 }: Props) {
  const t = useTheme();
  const letters = available.has('#') ? ALPHABET : ALPHABET.slice(1);
  const count = letters.length;
  const height = useSharedValue(1);
  const active = useSharedValue(-1);
  const touchY = useSharedValue(0);
  const shown = useSharedValue(0);
  const [bubbleLetter, setBubbleLetter] = useState('');

  const select = useCallback(
    (i: number) => {
      const letter = letters[i];
      setBubbleLetter(letter);
      haptic();
      if (available.has(letter)) return onSelect(letter);
      // Nearest earlier letter with entries, else the next one after.
      for (let k = i - 1; k >= 0; k--) if (available.has(letters[k])) return onSelect(letters[k]);
      for (let k = i + 1; k < letters.length; k++) if (available.has(letters[k])) return onSelect(letters[k]);
    },
    [letters, available, onSelect]
  );

  const update = (y: number) => {
    'worklet';
    const h = height.value;
    const cy = Math.min(h, Math.max(0, y));
    touchY.value = cy;
    const i = Math.min(count - 1, Math.max(0, Math.floor((cy / h) * count)));
    if (i !== active.value) {
      active.value = i;
      scheduleOnRN(select, i);
    }
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .hitSlop({ left: 14, right: 6 })
    .onBegin((e) => {
      shown.value = withSpring(1, { damping: 16, stiffness: 260 });
      update(e.y);
    })
    .onUpdate((e) => update(e.y))
    .onFinalize(() => {
      shown.value = withTiming(0, { duration: 220 });
      active.value = -1;
    });

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateY: touchY.value - BUBBLE / 2 },
      { translateX: (1 - shown.value) * 24 },
      { scale: 0.6 + shown.value * 0.4 },
    ],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(shown.value, [0, 1], [t.chip, t.dark ? '#33353D' : '#DCDEE4']),
  }));

  return (
    <View style={[styles.wrap, { top, bottom }]} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.bubble, { backgroundColor: t.accent }, bubbleStyle]}>
        <Text style={styles.bubbleText}>{bubbleLetter}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.pill, pillStyle]}
          onLayout={(e) => {
            height.value = e.nativeEvent.layout.height;
          }}
        >
          {letters.map((l, i) => (
            <Letter
              key={l}
              letter={l}
              index={i}
              active={active}
              has={available.has(l)}
              color={t.textSecondary}
              activeColor={t.accent}
              mutedColor={t.textTertiary}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 5,
    width: 24,
  },
  pill: {
    flex: 1,
    width: 24,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  letter: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    right: 44,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderBottomRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
});
