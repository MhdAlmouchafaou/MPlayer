import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { VaultItem } from '../../modules/mplayer-core';
import { IconButton } from '../components/ui';
import { useVault } from '../store/vault';

function Zoomable({ item, width, height }: { item: VaultItem; width: number; height: number }) {
  const scale = useSharedValue(1);
  const start = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(6, start.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });
  // Panning only applies when zoomed, so the list can still swipe between photos.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (scale.value > 1.05) state.activate();
      else state.fail();
    })
    .onStart(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    })
    .onUpdate((e) => {
      const mx = (width * (scale.value - 1)) / 2;
      const my = (height * (scale.value - 1)) / 2;
      tx.value = Math.max(-mx, Math.min(mx, sx.value + e.translationX));
      ty.value = Math.max(-my, Math.min(my, sy.value + e.translationY));
    });
  const dbl = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.value < 1.5;
      scale.value = withSpring(zoomIn ? 2.5 : 1);
      if (!zoomIn) {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, dbl)}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={{ uri: item.uri }} style={{ width, height }} contentFit="contain" transition={120} />
      </Animated.View>
    </GestureDetector>
  );
}

export default function VaultImage() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const all = useVault((s) => s.items);
  const images = useMemo(() => all.filter((i) => i.kind === 'image'), [all]);
  const start = Math.max(0, images.findIndex((i) => i.id === id));
  const [index, setIndex] = useState(start);
  const list = useRef<FlatList<VaultItem>>(null);
  const current = images[index];
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <FlatList
        ref={list}
        data={images}
        horizontal
        pagingEnabled
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <Zoomable item={item} width={width} height={height} />}
      />
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <IconButton name="chevronLeft" size={26} color="#fff" label="Retour" onPress={() => router.back()} />
        <Text numberOfLines={1} style={styles.name}>
          {current?.name ?? ''}
        </Text>
        <Text style={styles.count}>
          {images.length ? `${index + 1}/${images.length}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: 'rgba(0,0,0,0.35)', paddingBottom: 6 },
  name: { flex: 1, color: '#fff', fontSize: 15.5, fontWeight: '600', marginLeft: 4 },
  count: { color: 'rgba(255,255,255,0.8)', fontSize: 13.5, marginRight: 12 },
});
