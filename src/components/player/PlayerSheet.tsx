import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { usePlayerPalette } from '../../lib/palette';
import { useLibrary } from '../../store/library';
import { usePlayer } from '../../store/player';
import { useUI } from '../../store/ui';
import { artistOf } from '../../utils';
import { Artwork } from '../Artwork';
import { Icon } from '../Icon';
import { haptic } from '../ui';
import { FullPlayer } from './FullPlayer';
import { QueuePanel } from './QueuePanel';

const MINI_HEIGHT = 64;
const SPRING = { damping: 26, stiffness: 230, mass: 0.9 };

function MiniControls() {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const previous = usePlayer((s) => s.previous);
  const btn = (name: 'prev' | 'next' | 'play' | 'pause', onPress: () => void, label: string) => (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 22 }}
      style={styles.miniBtn}
    >
      <Icon name={name} size={name === 'play' || name === 'pause' ? 25 : 25} color="#fff" />
    </Pressable>
  );
  return (
    <>
      {btn('prev', previous, 'Précédent')}
      {btn(isPlaying ? 'pause' : 'play', toggle, isPlaying ? 'Pause' : 'Lire')}
      {btn('next', next, 'Suivant')}
    </>
  );
}

/** Mini player that expands into the full-screen player with a vertical drag. */
export function PlayerSheet() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const open = useUI((s) => s.playerOpen);
  const setOpen = useUI((s) => s.setPlayerOpen);
  const currentId = usePlayer((s) => s.queue[s.index]);
  const track = useLibrary((s) => (currentId ? s.byId[currentId] : undefined));
  const palette = usePlayerPalette(track);
  const [queueOpen, setQueueOpen] = useState(false);
  const [mounted, setMounted] = useState(open);

  const progress = useSharedValue(open ? 1 : 0);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (open) setMounted(true);
    if (!dragging.value) progress.value = withSpring(open ? 1 : 0, SPRING, (done) => {
      if (done && !open) scheduleOnRN(setMounted, false);
    });
    if (!open) setQueueOpen(false);
  }, [open, progress, dragging]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (queueOpen) setQueueOpen(false);
      else setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open, queueOpen, setOpen]);

  const settle = (expand: boolean) => {
    setOpen(expand);
    if (expand) setMounted(true);
  };

  const miniPan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-20, 20])
    .onBegin(() => {
      dragging.value = true;
    })
    .onStart(() => {
      scheduleOnRN(setMounted, true);
    })
    .onUpdate((e) => {
      progress.value = Math.min(1, Math.max(0, -e.translationY / height));
    })
    .onEnd((e) => {
      const expand = e.velocityY < -400 || progress.value > 0.22;
      progress.value = withSpring(expand ? 1 : 0, SPRING);
      scheduleOnRN(settle, expand);
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  const fullPan = Gesture.Pan()
    .activeOffsetY([-1000, 14])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      dragging.value = true;
    })
    .onUpdate((e) => {
      progress.value = Math.min(1, Math.max(0, 1 - e.translationY / height));
    })
    .onEnd((e) => {
      const collapse = e.velocityY > 500 || progress.value < 0.75;
      progress.value = withSpring(collapse ? 0 : 1, SPRING);
      scheduleOnRN(settle, !collapse);
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height }],
    borderTopLeftRadius: interpolate(progress.value, [0.9, 1], [32, 0], Extrapolation.CLAMP),
    borderTopRightRadius: interpolate(progress.value, [0.9, 1], [32, 0], Extrapolation.CLAMP),
  }));
  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: -progress.value * 120 }],
  }));

  const visible = !!track;

  return (
    <>
      {visible ? (
        <GestureDetector gesture={miniPan}>
          <Animated.View style={[styles.mini, { bottom: insets.bottom + 6, backgroundColor: palette.mini }, miniStyle]}>
            <Pressable
              style={styles.miniMain}
              onPress={() => {
                setMounted(true);
                setOpen(true);
              }}
              accessibilityLabel="Ouvrir le lecteur"
            >
              <Artwork
                trackId={track.id}
                albumId={track.albumId}
                size={46}
                radius={23}
                placeholderColor="rgba(255,255,255,0.16)"
                iconColor="#fff"
                style={{ borderWidth: 0 }}
              />
              <View style={styles.miniText}>
                <Text numberOfLines={1} style={styles.miniTitle}>
                  {track.title}
                </Text>
                <Text numberOfLines={1} style={styles.miniArtist}>
                  {artistOf(track)}
                </Text>
              </View>
            </Pressable>
            <MiniControls />
            <Pressable
              onPress={() => {
                setMounted(true);
                setQueueOpen(true);
                setOpen(true);
              }}
              accessibilityLabel="File d'attente"
              android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 22 }}
              style={styles.miniBtn}
            >
              <Icon name="queue" size={25} color="#fff" strokeWidth={1.8} />
            </Pressable>
          </Animated.View>
        </GestureDetector>
      ) : null}

      {mounted ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.sheet, sheetStyle]} pointerEvents={open ? 'auto' : 'none'}>
          <GestureDetector gesture={fullPan}>
            <View style={StyleSheet.absoluteFill}>
              <FullPlayer
                track={track}
                palette={palette}
                onClose={() => {
                  progress.value = withTiming(0, { duration: 260 });
                  setOpen(false);
                }}
                onOpenQueue={() => setQueueOpen(true)}
              />
            </View>
          </GestureDetector>
        </Animated.View>
      ) : null}
      {/* Own window: no gesture of the player can steal the queue's scroll. */}
      <QueuePanel visible={queueOpen} onClose={() => setQueueOpen(false)} />
    </>
  );
}

export { MINI_HEIGHT };

const styles = StyleSheet.create({
  mini: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: MINI_HEIGHT,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 9,
    paddingRight: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  miniMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  miniText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  miniTitle: {
    color: '#fff',
    fontSize: 16.5,
    fontWeight: '600',
  },
  miniArtist: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    marginTop: 1,
  },
  miniBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    overflow: 'hidden',
  },
});
