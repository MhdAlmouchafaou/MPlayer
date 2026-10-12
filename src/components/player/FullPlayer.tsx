import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Native } from '../../../modules/mplayer-core';
import { albumIdOf, openCollection, openTrackMenu, showTrackDetails } from '../../lib/actions';
import type { PlayerPalette } from '../../lib/palette';
import type { Track } from '../../store/library';
import { usePlayer } from '../../store/player';
import { toast, useUI } from '../../store/ui';
import { useUserStore } from '../../store/user';
import { useTheme } from '../../theme';
import { artistOf, formatTime } from '../../utils';
import { Artwork } from '../Artwork';
import { Icon } from '../Icon';
import { PopupMenu, type MenuItem } from '../PopupMenu';
import { haptic, IconButton, Slider } from '../ui';
import { Backdrop } from './Backdrop';
import { FavoriteButton } from './FavoriteButton';
import { router } from 'expo-router';

const WHITE = '#FFFFFF';

function Progress() {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position;
  return (
    <View style={styles.progress}>
      <Slider
        value={duration > 0 ? Math.min(shown, duration) : 0}
        min={0}
        max={Math.max(duration, 1)}
        onChange={setScrub}
        onComplete={(v) => {
          seek(v);
          setTimeout(() => setScrub(null), 250);
        }}
        trackHeight={3}
        trackColor="rgba(255,255,255,0.42)"
        fillColor="rgba(255,255,255,0.95)"
        thumbColor={WHITE}
        thumbSize={22}
      />
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(shown)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

function PlayPause({ size = 44 }: { size?: number }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.togglePlay);
  const bg = useSharedValue(isPlaying ? 0 : 1);
  useEffect(() => {
    bg.value = withTiming(isPlaying ? 0 : 1, { duration: 220 });
  }, [isPlaying, bg]);
  const circle = useAnimatedStyle(() => ({ opacity: bg.value, transform: [{ scale: 0.7 + bg.value * 0.3 }] }));
  return (
    <Pressable
      onPress={() => {
        haptic();
        toggle();
      }}
      accessibilityLabel={isPlaying ? 'Pause' : 'Lire'}
      style={styles.playButton}
    >
      <Animated.View style={[styles.playCircle, circle]} />
      <Icon name={isPlaying ? 'pause' : 'play'} size={size} color={WHITE} />
    </Pressable>
  );
}

function Controls() {
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const next = usePlayer((s) => s.next);
  const previous = usePlayer((s) => s.previous);
  return (
    <View style={styles.controls}>
      <IconButton
        name="shuffle"
        size={27}
        color={WHITE}
        style={{ opacity: shuffle ? 1 : 0.55 }}
        strokeWidth={1.8}
        label="Lecture aléatoire"
        onPress={() => {
          haptic();
          toggleShuffle();
          toast(shuffle ? 'Lecture aléatoire désactivée' : 'Lecture aléatoire activée');
        }}
      />
      <IconButton name="prev" size={34} color={WHITE} hitSize={60} label="Précédent" onPress={previous} />
      <PlayPause />
      <IconButton name="next" size={34} color={WHITE} hitSize={60} label="Suivant" onPress={next} />
      <IconButton
        name={repeat === 1 ? 'repeatOne' : 'repeat'}
        size={27}
        color={WHITE}
        strokeWidth={1.8}
        style={{ opacity: repeat === 0 ? 0.55 : 1 }}
        label="Répétition"
        onPress={() => {
          haptic();
          cycleRepeat();
          const next = ([0, 2, 1] as const)[([0, 2, 1].indexOf(repeat) + 1) % 3];
          toast(next === 0 ? 'Répétition désactivée' : next === 2 ? 'Répéter tous les morceaux' : 'Répéter le morceau en cours');
        }}
      />
    </View>
  );
}

function VolumePanel({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [volume, setVolume] = useState<number | null>(null);
  useEffect(() => {
    Native?.getVolume().then(setVolume).catch(() => setVolume(0.5));
  }, []);
  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[styles.volume, { backgroundColor: t.menu }]}>
        <Icon name="volume" size={22} color={t.icon} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          {volume !== null ? (
            <Slider
              value={volume}
              onChange={(v) => Native?.setVolume(v)}
              onComplete={(v) => Native?.setVolume(v)}
              trackHeight={12}
              trackColor={t.accentTrack}
              fillColor={t.accentSoft}
              thumbColor={t.surfaceAlt}
              thumbBorderColor={t.accentSoft}
              thumbSize={24}
            />
          ) : null}
        </View>
      </Animated.View>
    </>
  );
}

const SLEEP_OPTIONS: { label: string; value: number | 'end' | null }[] = [
  { label: 'Désactivé', value: null },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 heure', value: 60 },
  { label: '1 h 30', value: 90 },
  { label: '2 heures', value: 120 },
  { label: 'À la fin du morceau', value: 'end' },
];

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type Props = { track: Track | undefined; palette: PlayerPalette; onClose: () => void; onOpenQueue: () => void };

export function FullPlayer({ track, palette, onClose, onOpenQueue }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const sleepEndsAt = usePlayer((s) => s.sleepEndsAt);
  const sleepEndOfTrack = usePlayer((s) => s.sleepEndOfTrack);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const isFav = useUserStore((s) => (track ? s.favorites.includes(track.id) : false));
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const speed = useUserStore((s) => s.settings.speed);
  const updateSettings = useUserStore((s) => s.updateSettings);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; title?: string } | null>(null);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const moreRef = useRef<View>(null);
  const timerRef = useRef<View>(null);

  // Artwork grows while playing and shrinks when paused, like One UI.
  const compact = height < 700;
  const big = Math.min(width * 0.8, height * (compact ? 0.36 : 0.42));
  const small = big * 0.59;
  const artSize = useSharedValue(isPlaying ? big : small);
  useEffect(() => {
    artSize.value = withSpring(isPlaying ? big : small, { damping: 18, stiffness: 140, mass: 0.9 });
  }, [isPlaying, big, small, artSize]);
  const boxStyle = useAnimatedStyle(() => ({
    height: artSize.value,
    marginTop: (big - artSize.value) * 0.3,
  }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: artSize.value / big }],
  }));


  const openMenuAt = (ref: React.RefObject<View | null>, items: MenuItem[], title?: string) => {
    ref.current?.measureInWindow((x, y, w, h) => setMenu({ x: x + w, y: y + h, items, title }));
  };

  const sleepActive = !!sleepEndsAt || sleepEndOfTrack;

  const moreItems = (): MenuItem[] =>
    track
      ? [
          { label: 'Ajouter à une liste de lecture', onPress: () => useUI.getState().pickPlaylist([track.id]) },
          { label: "Aller à l'album", onPress: () => openCollection('album', albumIdOf(track)) },
          { label: "Aller à l'artiste", onPress: () => openCollection('artist', track.artist || 'Inconnu') },
          {
            label: 'Vitesse de lecture',
            hint: `${speed.toString().replace('.', ',')}x`,
            onPress: () =>
              setTimeout(
                () =>
                  openMenuAt(
                    moreRef,
                    SPEEDS.map((s) => ({
                      label: `${s.toString().replace('.', ',')}x`,
                      checked: Math.abs(s - speed) < 0.01,
                      onPress: () => {
                        updateSettings({ speed: s });
                        Native?.setSpeed(s);
                      },
                    })),
                    'Vitesse de lecture'
                  ),
                60
              ),
          },
          { label: 'Plus d’options', onPress: () => openTrackMenu(track) },
          { label: 'Détails', onPress: () => showTrackDetails(track) },
          {
            label: 'Paramètres',
            onPress: () => {
              onClose();
              setTimeout(() => router.push('/settings'), 260);
            },
          },
        ]
      : [];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Backdrop palette={palette} playing={isPlaying} />
      <View style={[styles.topBar, { marginTop: insets.top + 6 }]}>
        <IconButton name="chevronDown" size={30} color={t.icon} strokeWidth={1.6} label="Réduire" onPress={onClose} />
        <View style={{ flex: 1 }} />
        <View ref={timerRef} collapsable={false}>
          <IconButton
            name="timer"
            size={26}
            color={sleepActive ? t.accent : t.icon}
            label="Mise en veille"
            onPress={() =>
              openMenuAt(
                timerRef,
                SLEEP_OPTIONS.map((o) => ({
                  label: o.label,
                  checked: o.value === null ? !sleepActive : o.value === 'end' ? sleepEndOfTrack : false,
                  onPress: () => {
                    setSleepTimer(o.value);
                    toast(o.value === null ? 'Mise en veille désactivée' : `Arrêt programmé : ${o.label.toLowerCase()}`);
                  },
                })),
                sleepEndsAt ? `Arrêt dans ${Math.max(1, Math.round((sleepEndsAt - Date.now()) / 60000))} min` : 'Mise en veille'
              )
            }
          />
        </View>
        <IconButton name="volume" size={26} color={t.icon} label="Volume" onPress={() => setVolumeOpen(true)} />
        <IconButton
          name="equalizer"
          size={26}
          color={t.icon}
          label="Égaliseur"
          onPress={() => {
            onClose();
            setTimeout(() => router.push('/equalizer'), 260);
          }}
        />
        <View ref={moreRef} collapsable={false}>
          <IconButton name="more" size={24} color={t.icon} label="Plus d'options" onPress={() => openMenuAt(moreRef, moreItems())} />
        </View>
      </View>

      <View style={styles.middle}>
        <Animated.View style={[{ width: big }, boxStyle]}>
          <Animated.View style={[{ width: big, height: big, transformOrigin: 'top' }, artStyle]}>
            <Artwork trackId={track?.id} albumId={track?.albumId} size={big} radius={big * 0.12} quality={720} />
          </Animated.View>
        </Animated.View>
        <Animated.View key={track?.id ?? 'none'} entering={FadeIn.duration(320)} style={{ alignItems: 'center' }}>
          <Text numberOfLines={2} style={[styles.title, { color: t.text }]}>
            {track?.title ?? 'Aucune lecture'}
          </Text>
          <Text numberOfLines={1} style={[styles.artist, { color: t.text }]}>
            {track ? artistOf(track) : ''}
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + (compact ? 14 : 30) }]}>
        <View style={styles.actions}>
          <IconButton name="queue" size={27} color={WHITE} label="File d'attente" onPress={onOpenQueue} />
          <FavoriteButton active={isFav} onToggle={() => track && toggleFavorite(track.id)} />
          <IconButton
            name="plus"
            size={30}
            color={WHITE}
            strokeWidth={1.6}
            label="Ajouter à une liste"
            onPress={() => track && useUI.getState().pickPlaylist([track.id])}
          />
        </View>
        <Progress />
        <Controls />
      </View>

      {volumeOpen ? <VolumePanel onClose={() => setVolumeOpen(false)} /> : null}

      <PopupMenu
        visible={!!menu}
        anchor={menu ? { x: menu.x, y: menu.y, align: 'right' } : null}
        items={menu?.items ?? []}
        title={menu?.title}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 22,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 23,
    marginTop: 30,
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 30,
  },
  artist: {
    fontSize: 16.5,
    marginTop: 8,
    opacity: 0.88,
  },
  bottom: {
    paddingHorizontal: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  heart: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    paddingHorizontal: 9,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  time: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  playButton: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(40,30,70,0.22)',
  },
  volume: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
});
