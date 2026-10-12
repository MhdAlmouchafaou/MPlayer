import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Icon, type IconName } from '../Icon';

export type Hud =
  | { type: 'level'; icon: IconName; value: number; max: number; label: string; boost?: boolean }
  | { type: 'scrub'; time: string; delta: string; mode: string; precise: boolean }
  | { type: 'speed'; value: number }
  | { type: 'zoom'; value: number }
  | null;

/** Big centred feedback while a gesture is in progress. */
export function GestureHud({ hud }: { hud: Hud }) {
  if (!hud) return null;
  if (hud.type === 'level') {
    const pct = Math.max(0, Math.min(1, hud.value / hud.max));
    const over = hud.max > 1 && hud.value > 1;
    return (
      <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(220)} pointerEvents="none" style={styles.levelWrap}>
        <View style={styles.levelCard}>
          <Icon name={hud.icon} size={24} color="#fff" />
          <View style={styles.levelTrack}>
            <View style={[styles.levelFill, { width: `${pct * 100}%`, backgroundColor: over ? '#FFB547' : '#fff' }]} />
            {hud.max > 1 ? <View style={[styles.levelTick, { left: `${(1 / hud.max) * 100}%` }]} /> : null}
          </View>
          <Text style={[styles.levelText, over && { color: '#FFB547' }]}>{hud.label}</Text>
        </View>
      </Animated.View>
    );
  }
  if (hud.type === 'scrub') {
    return (
      <Animated.View entering={FadeIn.duration(100)} exiting={FadeOut.duration(200)} pointerEvents="none" style={styles.center}>
        <Text style={styles.scrubTime}>{hud.time}</Text>
        <Text style={styles.scrubDelta}>{hud.delta}</Text>
        <View style={[styles.modePill, hud.precise && { backgroundColor: 'rgba(255,181,71,0.9)' }]}>
          <Text style={[styles.modeText, hud.precise && { color: '#1A1300' }]}>{hud.mode}</Text>
        </View>
        <Text style={styles.scrubHint}>Glissez vers le bas pour plus de précision</Text>
      </Animated.View>
    );
  }
  if (hud.type === 'speed') {
    return (
      <Animated.View entering={ZoomIn.duration(160)} exiting={FadeOut.duration(200)} pointerEvents="none" style={styles.topCenter}>
        <View style={styles.speedPill}>
          <Icon name="forward10" size={18} color="#fff" />
          <Text style={styles.speedText}>{hud.value.toFixed(2).replace(/0$/, '').replace('.', ',')}x</Text>
        </View>
        <Text style={styles.speedHint}>Glissez vers le haut ou le bas pour ajuster</Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(100)} exiting={FadeOut.duration(250)} pointerEvents="none" style={styles.topCenter}>
      <View style={styles.speedPill}>
        <Icon name="zoomIn" size={18} color="#fff" />
        <Text style={styles.speedText}>{Math.round(hud.value * 100)} %</Text>
      </View>
    </Animated.View>
  );
}

export function Buffering() {
  return (
    <Animated.View entering={FadeIn.delay(250).duration(200)} exiting={FadeOut.duration(150)} pointerEvents="none" style={styles.center}>
      <ActivityIndicator size="large" color="#fff" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  topCenter: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center' },
  levelWrap: { position: 'absolute', top: 72, left: 0, right: 0, alignItems: 'center' },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,24,0.78)',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 18,
    width: 270,
  },
  levelTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 14, overflow: 'hidden' },
  levelFill: { height: '100%', borderRadius: 3 },
  levelTick: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.5)' },
  levelText: { color: '#fff', fontSize: 15, fontWeight: '700', width: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  scrubTime: { color: '#fff', fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 12 },
  scrubDelta: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  modePill: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingHorizontal: 14, height: 30, justifyContent: 'center' },
  modeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scrubHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,20,24,0.78)',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
  },
  speedText: { color: '#fff', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  speedHint: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 8, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
