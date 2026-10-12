import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Native } from '../../../modules/mplayer-core';
import { fmt } from '../../store/video';

type Props = {
  position: number;
  duration: number;
  uri: string;
  markers?: number[];
  loopA?: number | null;
  loopB?: number | null;
  accent: string;
  onScrubStart: () => void;
  onScrub: (ms: number) => void;
  onScrubEnd: (ms: number) => void;
};

const PREVIEW_W = 168;

/**
 * Seek bar with a live frame preview above the thumb while dragging, chapter-like markers
 * for saved moments and the A–B loop range.
 */
export function SeekBar({ position, duration, uri, markers = [], loopA, loopB, accent, onScrubStart, onScrub, onScrubEnd }: Props) {
  const width = useSharedValue(1);
  const ratio = useSharedValue(0);
  const active = useSharedValue(0);
  const dragging = useRef(false);
  const [layoutW, setLayoutW] = useState(1);
  const [preview, setPreview] = useState<{ ms: number; frame: string | null } | null>(null);
  const pending = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!dragging.current && duration > 0) ratio.value = withTiming(Math.min(1, position / duration), { duration: 180 });
  }, [position, duration, ratio]);

  const fetchFrame = useCallback(
    (ms: number) => {
      pending.current = ms;
      if (busy.current || !Native) return;
      busy.current = true;
      const run = (target: number) => {
        Native!.getFrameAt(uri, target, PREVIEW_W * 2, false)
          .then((frame) => {
            if (dragging.current) setPreview((p) => (p ? { ...p, frame: frame ?? p.frame } : p));
          })
          .catch(() => {})
          .finally(() => {
            const next = pending.current;
            if (next !== null && Math.abs(next - target) > 900 && dragging.current) run(next);
            else busy.current = false;
          });
      };
      run(ms);
    },
    [uri]
  );

  const begin = useCallback(() => {
    dragging.current = true;
    onScrubStart();
  }, [onScrubStart]);

  const move = useCallback(
    (r: number) => {
      const ms = r * duration;
      setPreview((p) => ({ ms, frame: p?.frame ?? null }));
      onScrub(ms);
      fetchFrame(ms);
    },
    [duration, onScrub, fetchFrame]
  );

  const end = useCallback(
    (r: number) => {
      dragging.current = false;
      setPreview(null);
      pending.current = null;
      onScrubEnd(r * duration);
    },
    [duration, onScrubEnd]
  );

  const pan = Gesture.Pan()
    .hitSlop({ top: 18, bottom: 18 })
    .minDistance(0)
    .onBegin((e) => {
      active.value = withTiming(1, { duration: 120 });
      ratio.value = Math.min(1, Math.max(0, e.x / width.value));
      scheduleOnRN(begin);
      scheduleOnRN(move, ratio.value);
    })
    .onUpdate((e) => {
      ratio.value = Math.min(1, Math.max(0, e.x / width.value));
      scheduleOnRN(move, ratio.value);
    })
    .onFinalize(() => {
      active.value = withTiming(0, { duration: 160 });
      scheduleOnRN(end, ratio.value);
    });

  const fill = useAnimatedStyle(() => ({ width: `${ratio.value * 100}%` }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: ratio.value * width.value - 9 }, { scale: 1 + active.value * 0.45 }],
  }));
  const track = useAnimatedStyle(() => ({ height: 3.5 + active.value * 3, borderRadius: 4 }));
  const bubble = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [
      { translateX: Math.min(Math.max(ratio.value * width.value - PREVIEW_W / 2, 0), width.value - PREVIEW_W) },
      { translateY: (1 - active.value) * 12 },
    ],
  }));

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.bubble, bubble]}>
        <View style={styles.frame}>
          {preview?.frame ? <Image source={{ uri: preview.frame }} style={StyleSheet.absoluteFill} contentFit="cover" transition={80} /> : null}
        </View>
        <Text style={styles.bubbleTime}>{preview ? fmt(preview.ms) : ''}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.hit}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width;
            setLayoutW(e.nativeEvent.layout.width);
          }}
        >
          <Animated.View style={[styles.track, track]}>
            {duration > 0 && loopA !== null && loopA !== undefined ? (
              <View
                style={[
                  styles.loop,
                  {
                    left: (loopA / duration) * layoutW,
                    width: loopB ? ((loopB - loopA) / duration) * layoutW : 3,
                  },
                ]}
              />
            ) : null}
            <Animated.View style={[styles.fill, { backgroundColor: accent }, fill]} />
          </Animated.View>
          {duration > 0
            ? markers.map((m) => <View key={m} pointerEvents="none" style={[styles.marker, { left: (m / duration) * layoutW - 2 }]} />)
            : null}
          <Animated.View pointerEvents="none" style={[styles.thumb, thumb]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 34, justifyContent: 'center' },
  track: { backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  fill: { height: '100%' },
  loop: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,210,80,0.55)' },
  marker: { position: 'absolute', top: 12, width: 4, height: 10, borderRadius: 2, backgroundColor: '#FFD25A' },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    elevation: 3,
  },
  bubble: { position: 'absolute', bottom: 40, left: 0, width: PREVIEW_W, alignItems: 'center' },
  frame: {
    width: PREVIEW_W,
    height: (PREVIEW_W * 9) / 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  bubbleTime: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
