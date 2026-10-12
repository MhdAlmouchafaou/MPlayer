import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const GAP = 48;

/** Single-line text that scrolls slowly when it is wider than its container. */
export function Marquee({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const x = useSharedValue(0);
  const overflow = content > box + 1 && box > 0;

  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (!overflow) return;
    const distance = content + GAP;
    const duration = Math.max(4000, distance * 28);
    x.value = withDelay(
      1600,
      withRepeat(withSequence(withTiming(-distance, { duration, easing: Easing.linear }), withDelay(1600, withTiming(0, { duration: 0 }))), -1, false)
    );
    return () => cancelAnimation(x);
  }, [overflow, content, text, x]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.box} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
      {/* Hidden copy measures the full natural width. */}
      <View style={styles.measure} pointerEvents="none">
        <Text style={style} numberOfLines={1} onLayout={(e) => setContent(e.nativeEvent.layout.width)}>
          {text}
        </Text>
      </View>
      <Animated.View style={[styles.row, anim]}>
        <Text style={style} numberOfLines={1} ellipsizeMode="clip">
          {text}
        </Text>
        {overflow ? (
          <Text style={[style, { marginLeft: GAP }]} numberOfLines={1}>
            {text}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', flexDirection: 'row' },
  measure: { position: 'absolute', opacity: 0, flexDirection: 'row', width: 4000 },
  row: { flexDirection: 'row', width: 4000 },
});
