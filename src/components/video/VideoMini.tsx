import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoThumb } from '../../lib/thumbs';
import { useUI } from '../../store/ui';
import { fmt, useVideo } from '../../store/video';
import { Icon } from '../Icon';

/** Shown while a video keeps playing in the background, to get back to it. */
export function VideoMini() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const active = useVideo((s) => s.active);
  const item = useVideo((s) => s.items[s.index]);
  const isPlaying = useVideo((s) => s.isPlaying);
  const position = useVideo((s) => s.position);
  const duration = useVideo((s) => s.duration);
  const bottomInset = useUI((s) => s.bottomInset);
  const thumb = useVideoThumb(item?.id ?? item?.uri, 320);
  if (!active || !item || pathname === '/video' || pathname === '/open') return null;
  return (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)} style={[styles.wrap, { bottom: insets.bottom + 6 + bottomInset }]}>
      <Pressable style={styles.main} onPress={() => router.push('/video')}>
        <View style={styles.thumb}>{thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={1} style={styles.title}>
            {item.title}
          </Text>
          <Text style={styles.sub}>
            {fmt(position)} / {fmt(duration)}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={() => useVideo.getState().toggle()} style={styles.btn} accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}>
        <Icon name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
      </Pressable>
      <Pressable onPress={() => useVideo.getState().close(false)} style={styles.btn} accessibilityLabel="Arrêter">
        <Icon name="close" size={22} color="#fff" strokeWidth={2} />
      </Pressable>
      <View style={[styles.progress, { width: `${duration > 0 ? (position / duration) * 100 : 0}%` }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#1D2433',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 6,
    overflow: 'hidden',
    elevation: 8,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' },
  thumb: { width: 76, height: 46, borderRadius: 10, overflow: 'hidden', backgroundColor: '#2C3446' },
  title: { color: '#fff', fontSize: 15.5, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 12.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progress: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: '#7EA6F5' },
});
