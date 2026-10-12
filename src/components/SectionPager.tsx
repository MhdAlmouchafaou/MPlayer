import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useEvent, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { TabsHeader } from './TabsHeader';

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

function usePageScroll(onScroll: (position: number, offset: number) => void) {
  return useEvent<{ position: number; offset: number }>(
    (e) => {
      'worklet';
      onScroll(e.position, e.offset);
    },
    ['onPageScroll']
  );
}

/** One UI tab strip and swipeable pages, shared by every section of the home screen. */
export function SectionPager({
  labels,
  pages,
  initial,
  onChange,
}: {
  labels: string[];
  pages: React.ReactNode[];
  initial: number;
  onChange?: (index: number) => void;
}) {
  const t = useTheme();
  const start = Math.min(Math.max(0, initial), labels.length - 1);
  const position = useSharedValue(start);
  const pager = useRef<PagerView>(null);
  const pageScroll = usePageScroll((p, o) => {
    'worklet';
    position.value = p + o;
  });
  return (
    <>
      <TabsHeader labels={labels} position={position} onPress={(i) => pager.current?.setPage(i)} />
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <AnimatedPager
          ref={pager}
          style={{ flex: 1 }}
          initialPage={start}
          offscreenPageLimit={1}
          onPageScroll={pageScroll as never}
          onPageSelected={(e: { nativeEvent: { position: number } }) => {
            const i = e.nativeEvent.position;
            onChange?.(i);
            if (Math.abs(position.value - i) > 0.01) position.value = withTiming(i, { duration: 220 });
          }}
        >
          {pages.map((page, i) => (
            <View key={labels[i]} style={{ flex: 1 }} collapsable={false}>
              {page}
            </View>
          ))}
        </AnimatedPager>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
});
