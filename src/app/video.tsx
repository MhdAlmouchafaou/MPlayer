import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getVideoSurface, Native } from '../../modules/mplayer-core';
import { Icon, type IconName } from '../components/Icon';
import { PopupMenu, type MenuItem } from '../components/PopupMenu';
import { haptic } from '../components/ui';
import { Buffering, GestureHud, type Hud } from '../components/video/GestureHud';
import { SeekBar } from '../components/video/SeekBar';
import { Marquee } from '../components/Marquee';
import { useVideoThumb } from '../lib/thumbs';
import { useMedia, type VideoSettings } from '../store/media';
import { toast, useUI } from '../store/ui';
import { fmt, useVideo } from '../store/video';
import { uid } from '../utils';
import { isVaultUri, useVault } from '../store/vault';

const RESIZE: { key: VideoSettings['resizeMode']; label: string }[] = [
  { key: 'fit', label: 'Ajuster' },
  { key: 'fill', label: 'Remplir l’écran' },
  { key: 'stretch', label: 'Étirer' },
  { key: '16:9', label: '16:9' },
  { key: '4:3', label: '4:3' },
];
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const SCRUB_MODES = [
  { limit: 70, factor: 1, label: 'Défilement rapide' },
  { limit: 150, factor: 0.5, label: 'Demi-vitesse' },
  { limit: 230, factor: 0.25, label: 'Quart de vitesse' },
  { limit: Infinity, factor: 0.06, label: 'Défilement précis' },
];

function Gradient({ top }: { top: boolean }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={top ? 'gt' : 'gb'} x1="0" y1={top ? '0' : '1'} x2="0" y2={top ? '1' : '0'}>
          <Stop offset="0" stopColor="#000" stopOpacity={0.72} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${top ? 'gt' : 'gb'})`} />
    </Svg>
  );
}

function Btn({
  icon,
  onPress,
  size = 24,
  label,
  active,
  onLongPress,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  size?: number;
  label: string;
  active?: boolean;
  onLongPress?: () => void;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      onLongPress={onLongPress}
      accessibilityLabel={label}
      hitSlop={6}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 24 }}
      style={[styles.btn, active && styles.btnActive]}
    >
      <Icon name={icon} size={size} color={active ? '#1A1300' : '#fff'} strokeWidth={1.8} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Ripple({ side, seconds }: { side: 'left' | 'right'; seconds: number }) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height) * 0.62;
  return (
    <Animated.View
      entering={FadeIn.duration(90)}
      exiting={FadeOut.duration(320)}
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top: height / 2 - size / 2,
          [side === 'left' ? 'left' : 'right']: -size * 0.42,
        },
      ]}
    >
      <View style={[styles.rippleInner, side === 'left' ? { marginLeft: size * 0.42 } : { marginRight: size * 0.42 }]}>
        <Icon name={side === 'left' ? 'replay10' : 'forward10'} size={30} color="#fff" strokeWidth={2} />
        <Text style={styles.rippleText}>{seconds} s</Text>
      </View>
    </Animated.View>
  );
}

export default function VideoPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const navigation = useNavigation();
  const Surface = getVideoSurface();

  const item = useVideo((s) => s.items[s.index]);
  const engine = useVideo((s) => s.engine);
  const isPlaying = useVideo((s) => s.isPlaying);
  const buffering = useVideo((s) => s.buffering);
  const position = useVideo((s) => s.position);
  const duration = useVideo((s) => s.duration);
  const videoW = useVideo((s) => s.videoW);
  const videoH = useVideo((s) => s.videoH);
  const speed = useVideo((s) => s.speed);
  const loopA = useVideo((s) => s.loopA);
  const loopB = useVideo((s) => s.loopB);
  const error = useVideo((s) => s.error);
  const ended = useVideo((s) => s.ended);
  const fellBack = useVideo((s) => s.fellBack);
  const index = useVideo((s) => s.index);
  const count = useVideo((s) => s.items.length);
  const sleepAt = useVideo((s) => s.sleepAt);
  const sleepEnd = useVideo((s) => s.sleepEnd);
  const repeatOne = useVideo((s) => s.repeatOne);
  const tracks = useVideo((s) => s.tracks);
  const vlcTracks = useVideo((s) => s.vlcTracks);
  const settings = useMedia((s) => s.video);
  const updateVideo = useMedia((s) => s.updateVideo);
  const moments = useMedia((s) => (item ? s.moments[item.key] : undefined)) ?? [];

  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockHint, setLockHint] = useState(false);
  const [hud, setHud] = useState<Hud>(null);
  const [ripple, setRipple] = useState<{ side: 'left' | 'right'; seconds: number; id: number } | null>(null);
  const [resizeMode, setResizeMode] = useState<VideoSettings['resizeMode']>(settings.resizeMode);
  const [mirror, setMirror] = useState(false);
  const [frameMode, setFrameMode] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [pip, setPip] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; title?: string } | null>(null);
  const [showRemaining, setShowRemaining] = useState(settings.showRemaining);
  const [flash, setFlash] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapBurst = useRef<{ side: 'left' | 'right'; total: number; at: number } | null>(null);
  const holdSpeed = useRef<number | null>(null);
  const scrubbing = useRef(false);
  const lastSeek = useRef(0);
  const brightness = useRef(0.5);
  const volume = useRef({ level: 0.5, max: 15, step: -1, boost: 0 });
  const rootRef = useRef<View>(null);
  const syncLevelsRef = useRef<() => void>(() => {});
  const thumb = useVideoThumb(item?.id ?? item?.uri, 320);

  // --- zoom / pan of the picture (UI thread) ---
  const zoom = useSharedValue(1);
  const zoomStart = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const txStart = useSharedValue(0);
  const tyStart = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  // --- screen setup ---
  useEffect(() => {
    if (!Native) return;
    Native.setImmersive(true);
    Native.setKeepAwake(true);
    Native.getBrightness().then((b) => {
      brightness.current = b;
      if (settings.rememberBrightness && settings.brightness >= 0) {
        brightness.current = settings.brightness;
        Native!.setBrightness(settings.brightness);
      }
      syncLevelsRef.current();
    });
    Native.getSystemVolume().then((v) => {
      volume.current = { level: v.current / Math.max(1, v.max), max: v.max, step: v.current, boost: 0 };
      syncLevelsRef.current();
    });
    return () => {
      Native!.setImmersive(false);
      Native!.setKeepAwake(false);
      Native!.setBrightness(-1);
      Native!.setOrientation('portrait');
      Native!.setAutoPip(false, 16, 9);
      Native!.setVolumeBoost(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Private videos: no screenshots, no preview in recent apps.
  const secret = isVaultUri(item?.uri);
  useEffect(() => {
    if (!secret) return;
    Native?.setSecure(true);
    return () => {
      // The vault grid may still be underneath: keep the protection while it is open.
      if (!useVault.getState().unlocked) Native?.setSecure(false);
      useVault.setState({ openMedia: false });
    };
  }, [secret]);

  // Hardware volume keys change the level behind our back: keep the swipe start in sync.
  useEffect(() => {
    const timer = setInterval(() => {
      Native?.getSystemVolume().then((v) => {
        const cur = volume.current;
        if (cur.boost > 0) return;
        if (v.current !== cur.step) {
          volume.current = { ...cur, level: v.current / Math.max(1, v.max), max: v.max, step: v.current };
          syncLevelsRef.current();
        }
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  // Auto-rotate: the screen follows how the phone is held. Off: stays as it is.
  useEffect(() => {
    if (!Native) return;
    Native.setOrientation(settings.autoRotate ? 'sensor' : 'locked');
  }, [settings.autoRotate]);

  // Auto picture-in-picture when leaving the app while playing (Android 12+).
  useEffect(() => {
    Native?.setAutoPip(settings.autoPip && isPlaying && !isVaultUri(item?.uri), videoW || 16, videoH || 9);
  }, [settings.autoPip, isPlaying, videoW, videoH, item?.uri]);

  // PiP detection: the window shrinks to a small size (checked again once settled).
  const smallWindow = W < 420 && H < 420;
  useEffect(() => {
    let alive = true;
    const check = () => Native?.isInPip().then((p) => alive && setPip(p || (W < 420 && H < 420)));
    check();
    const t1 = setTimeout(check, 350);
    return () => {
      alive = false;
      clearTimeout(t1);
    };
  }, [W, H]);
  const inPip = pip || smallWindow;

  // Activity stopped: the PiP window was closed or the app left without PiP.
  useEffect(() => {
    if (!Native) return;
    const sub = Native.addListener('onActivityStop', () => {
      if (!useMedia.getState().video.background) useVideo.getState().pause();
    });
    return () => sub.remove();
  }, []);

  // Going to background: keep playing (PiP / background audio) or pause.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        Native?.isInPip().then((inPip) => {
          if (!inPip && !useMedia.getState().video.background) useVideo.getState().pause();
        });
        useVideo.getState().saveProgress();
      }
    });
    return () => sub.remove();
  }, []);

  const close = useCallback(() => {
    const keep = useMedia.getState().video.background && useVideo.getState().isPlaying;
    useVideo.getState().close(keep);
    if (keep) toast('Lecture du son en arrière-plan');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menu) {
        setMenu(null);
        return true;
      }
      if (locked) {
        setLockHint(true);
        return true;
      }
      close();
      return true;
    });
    return () => sub.remove();
  }, [menu, locked, close]);

  useEffect(() => navigation.addListener('beforeRemove', () => useVideo.getState().saveProgress()), [navigation]);

  // --- controls visibility ---
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (useVideo.getState().isPlaying && !scrubbing.current) setControls(false);
    }, 3800);
  }, []);
  const showControls = useCallback(
    (v: boolean) => {
      setControls(v);
      if (v) scheduleHide();
    },
    [scheduleHide]
  );
  useEffect(() => {
    controlsOpacity.value = withTiming(controls && !locked ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [controls, locked, controlsOpacity]);
  useEffect(() => {
    if (isPlaying) scheduleHide();
    else setControls(true);
  }, [isPlaying, scheduleHide]);

  const flashHud = useCallback((h: Hud, ms = 700) => {
    setHud(h);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), ms);
  }, []);

  // --- taps ---
  const seekSeconds = settings.doubleTapSeconds;
  const burst = useCallback(
    (side: 'left' | 'right') => {
      const now = Date.now();
      const b = tapBurst.current;
      const total = b && b.side === side && now - b.at < 800 ? b.total + seekSeconds : seekSeconds;
      tapBurst.current = { side, total, at: now };
      useVideo.getState().seekBy((side === 'left' ? -1 : 1) * seekSeconds * 1000);
      setRipple({ side, seconds: total, id: now });
      haptic();
      setTimeout(() => {
        if (tapBurst.current && Date.now() - tapBurst.current.at >= 780) {
          tapBurst.current = null;
          setRipple(null);
        }
      }, 820);
    },
    [seekSeconds]
  );

  const onSingleTap = useCallback(
    (x: number) => {
      if (locked) {
        setLockHint((v) => !v);
        return;
      }
      const b = tapBurst.current;
      if (b && Date.now() - b.at < 800) {
        const side = x < W * 0.4 ? 'left' : x > W * 0.6 ? 'right' : null;
        if (side === b.side) return burst(side);
      }
      showControls(!controls);
    },
    [locked, controls, showControls, burst, W]
  );

  const onDoubleTap = useCallback(
    (x: number) => {
      if (locked) return;
      if (zoom.value > 1.05) {
        zoom.value = withSpring(1);
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        return;
      }
      if (x < W * 0.38) burst('left');
      else if (x > W * 0.62) burst('right');
      else {
        haptic();
        useVideo.getState().toggle();
      }
    },
    [locked, burst, W, zoom, tx, ty]
  );

  // --- vertical swipes ---
  const applyBrightness = useCallback(
    (level: number) => {
      brightness.current = level;
      Native?.setBrightness(level);
      if (settings.rememberBrightness) updateVideo({ brightness: level });
      setHud({ type: 'level', icon: 'sun', value: level, max: 1, label: `${Math.round(level * 100)}%`, side: 'left' });
    },
    [settings.rememberBrightness, updateVideo]
  );
  const applyVolume = useCallback((level: number) => {
    const v = volume.current;
    v.level = level;
    const step = Math.round(Math.min(1, level) * v.max);
    if (step !== v.step) {
      v.step = step;
      Native?.setSystemVolumeStep(step);
    }
    const boost = level > 1 ? Math.round((level - 1) * 1500) : 0;
    if (Math.abs(boost - v.boost) >= 30 || (boost === 0 && v.boost !== 0)) {
      v.boost = boost;
      Native?.setVolumeBoost(boost);
    }
    setHud({ type: 'level', icon: 'volume', value: level, max: 2, label: `${Math.round(level * 100)}%`, boost: level > 1, side: 'right' });
  }, []);
  const endLevel = useCallback(() => {
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), 500);
  }, []);

  // --- horizontal scrub (iPhone style: drag down to slow down) ---
  const scrubStart = useRef({ pos: 0 });
  const onScrubBegin = useCallback(() => {
    scrubbing.current = true;
    scrubStart.current.pos = useVideo.getState().position;
    if (useVideo.getState().engine === 'exo') Native?.setSeekMode(false);
  }, []);
  const onScrubMove = useCallback(
    (pos: number, modeIndex: number) => {
      const d = useVideo.getState().duration;
      const p = Math.max(0, Math.min(pos, d || pos));
      const precise = modeIndex >= 2;
      const delta = p - scrubStart.current.pos;
      setHud({
        type: 'scrub',
        time: fmt(p, precise),
        delta: `${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta), precise)}`,
        mode: SCRUB_MODES[modeIndex].label,
        precise,
      });
      const now = Date.now();
      if (now - lastSeek.current > (precise ? 140 : 90)) {
        lastSeek.current = now;
        if (useVideo.getState().engine === 'exo') {
          Native?.setSeekMode(precise);
          Native?.seekTo(p);
        } else Native?.vlcSeek(p, !precise);
        useVideo.setState({ position: p });
      }
    },
    []
  );
  const onScrubEnd = useCallback((pos: number) => {
    scrubbing.current = false;
    const d = useVideo.getState().duration;
    const p = Math.max(0, Math.min(pos, d || pos));
    if (useVideo.getState().engine === 'exo') Native?.setSeekMode(true);
    useVideo.getState().seek(p);
    setTimeout(() => setHud(null), 350);
    scheduleHide();
  }, [scheduleHide]);

  // --- long press: temporary speed ---
  const onHoldStart = useCallback(() => {
    holdSpeed.current = useVideo.getState().speed;
    haptic();
    useVideo.getState().setSpeed(2);
    setHud({ type: 'speed', value: 2 });
  }, []);
  const onHoldMove = useCallback((dy: number) => {
    const s = Math.max(1.25, Math.min(4, Math.round((2 - dy / 60) * 4) / 4));
    if (s !== useVideo.getState().speed) {
      haptic();
      useVideo.getState().setSpeed(s);
      setHud({ type: 'speed', value: s });
    }
  }, []);
  const onHoldEnd = useCallback(() => {
    if (holdSpeed.current === null) return;
    useVideo.getState().setSpeed(holdSpeed.current);
    holdSpeed.current = null;
    setHud(null);
  }, []);

  // --- gestures ---
  const gesturesOn = settings.gestures && !locked && !inPip;
  const mode = useSharedValue(0); // 1 scrub, 2 brightness, 3 volume, 4 move picture
  const startLevel = useSharedValue(0);
  const scrubPos = useSharedValue(0);
  const lastX = useSharedValue(0);
  const lastLevel = useSharedValue(-1);
  const brightRef = useSharedValue(0.5);
  const volRef = useSharedValue(0.5);
  const durationSV = useSharedValue(duration);
  const posSV = useSharedValue(position);
  useEffect(() => {
    durationSV.value = duration;
  }, [duration, durationSV]);
  useEffect(() => {
    posSV.value = position;
  }, [position, posSV]);
  const syncLevels = useCallback(() => {
    brightRef.value = brightness.current;
    volRef.value = volume.current.level;
  }, [brightRef, volRef]);
  syncLevelsRef.current = syncLevels;

  // The direction is decided on the first real movement (onStart can report zero
  // translation), with a bias towards horizontal so seeking is easy to trigger.
  const pan = Gesture.Pan()
    .enabled(gesturesOn)
    .maxPointers(1)
    .minDistance(10)
    .onStart(() => {
      mode.value = 0;
      if (zoom.value > 1.05) {
        mode.value = 4;
        txStart.value = tx.value;
        tyStart.value = ty.value;
      }
    })
    .onUpdate((e) => {
      if (mode.value === 0) {
        const ax = Math.abs(e.translationX);
        const ay = Math.abs(e.translationY);
        if (ax < 10 && ay < 10) return;
        if (ax >= ay * 0.75) {
          mode.value = 1;
          scrubPos.value = posSV.value;
          lastX.value = e.translationX;
          scheduleOnRN(onScrubBegin);
        } else {
          const startX = e.x - e.translationX;
          mode.value = startX < W / 2 ? 2 : 3;
          startLevel.value = mode.value === 2 ? brightRef.value : volRef.value;
          lastLevel.value = -1;
        }
        return;
      }
      if (mode.value === 4) {
        const maxX = (W * (zoom.value - 1)) / 2;
        const maxY = (H * (zoom.value - 1)) / 2;
        tx.value = Math.max(-maxX, Math.min(maxX, txStart.value + e.translationX));
        ty.value = Math.max(-maxY, Math.min(maxY, tyStart.value + e.translationY));
        return;
      }
      if (mode.value === 1) {
        const dy = Math.abs(e.translationY);
        let m = 0;
        while (m < 3 && dy >= [70, 150, 230][m]) m++;
        const factor = [1, 0.5, 0.25, 0.06][m];
        const base = Math.max(25, Math.min(1200, durationSV.value / (W * 1.1)));
        const maxPos = durationSV.value > 0 ? durationSV.value : 1e12;
        scrubPos.value = Math.max(0, Math.min(maxPos, scrubPos.value + (e.translationX - lastX.value) * base * factor));
        lastX.value = e.translationX;
        scheduleOnRN(onScrubMove, scrubPos.value, m);
        return;
      }
      const range = mode.value === 2 ? 1 : 2;
      const sensitivity = H * 0.75;
      const v = Math.max(mode.value === 2 ? 0.01 : 0, Math.min(range, startLevel.value - (e.translationY / sensitivity) * (mode.value === 2 ? 1 : 1.4)));
      if (Math.abs(v - lastLevel.value) >= 0.01) {
        lastLevel.value = v;
        if (mode.value === 2) {
          brightRef.value = v;
          scheduleOnRN(applyBrightness, v);
        } else {
          volRef.value = v;
          scheduleOnRN(applyVolume, v);
        }
      }
    })
    .onFinalize(() => {
      if (mode.value === 1) scheduleOnRN(onScrubEnd, scrubPos.value);
      else if (mode.value === 2 || mode.value === 3) scheduleOnRN(endLevel);
      mode.value = 0;
    });

  const hold = Gesture.Pan()
    .enabled(gesturesOn)
    .activateAfterLongPress(420)
    .onStart(() => {
      scheduleOnRN(onHoldStart);
    })
    .onUpdate((e) => {
      scheduleOnRN(onHoldMove, e.translationY);
    })
    .onFinalize(() => {
      scheduleOnRN(onHoldEnd);
    });

  const pinch = Gesture.Pinch()
    .enabled(!locked && !inPip)
    .onStart(() => {
      zoomStart.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = Math.max(0.6, Math.min(5, zoomStart.value * e.scale));
      scheduleOnRN(setHud, { type: 'zoom', value: zoom.value });
    })
    .onEnd(() => {
      if (zoom.value < 1) {
        zoom.value = withSpring(1);
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
      scheduleOnRN(endLevel);
    });

  const doubleTap = Gesture.Tap()
    .enabled(!inPip)
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((e, ok) => {
      if (ok) scheduleOnRN(onDoubleTap, e.x);
    });
  const singleTap = Gesture.Tap()
    .enabled(!inPip)
    .onEnd((e, ok) => {
      if (ok) scheduleOnRN(onSingleTap, e.x);
    });

  const gesture = Gesture.Simultaneous(pinch, Gesture.Race(pan, hold, Gesture.Exclusive(doubleTap, singleTap)));

  const pictureStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zoom.value }, { scaleX: mirror ? -1 : 1 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: controlsOpacity.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  // --- tools ---
  const capture = useCallback(async () => {
    if (!Native || !item) return;
    if (isVaultUri(item.uri)) return toast('Capture désactivée pour les vidéos privées');
    flashOpacity.value = 0.85;
    flashOpacity.value = withTiming(0, { duration: 380 });
    setFlash((f) => f + 1);
    const name = `MPlayer_${item.title.replace(/[^\w-]+/g, '_').slice(0, 40)}_${Math.round(useVideo.getState().position / 1000)}s`;
    let uri = await Native.captureFrame(name).catch(() => null);
    if (!uri) uri = await Native.getFrameAt(item.uri, useVideo.getState().position, 1920, true).catch(() => null);
    toast(uri ? 'Capture enregistrée dans Images › MPlayer' : 'Capture impossible pour cette vidéo');
  }, [item, flashOpacity]);

  const addMoment = useCallback(async () => {
    if (!item) return;
    if (isVaultUri(item.uri)) return toast('Moments désactivés pour les vidéos privées');
    const pos = useVideo.getState().position;
    const frame = Native ? await Native.getFrameAt(item.uri, pos, 320, false).catch(() => null) : null;
    useMedia.getState().addMoment(item.key, { id: uid(), position: pos, label: `Moment à ${fmt(pos)}`, thumb: frame, at: Date.now() });
    toast(`Moment enregistré à ${fmt(pos)}`);
  }, [item]);

  const cycleLoop = useCallback(() => {
    const s = useVideo.getState();
    if (s.loopA === null) {
      s.setLoop(s.position, null);
      toast('Point A placé — touchez encore pour le point B');
    } else if (s.loopB === null) {
      if (s.position <= s.loopA + 500) return toast('Le point B doit être après le point A');
      s.setLoop(s.loopA, s.position);
      s.seek(s.loopA);
      toast(`Boucle A–B : ${fmt(s.loopA)} → ${fmt(s.position)}`);
    } else {
      s.setLoop(null, null);
      toast('Boucle A–B désactivée');
    }
  }, []);

  const cycleResize = useCallback(() => {
    const i = RESIZE.findIndex((r) => r.key === resizeMode);
    const next = RESIZE[(i + 1) % RESIZE.length];
    setResizeMode(next.key);
    zoom.value = withSpring(1);
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    toast(next.label);
  }, [resizeMode, zoom, tx, ty]);

  // Manual rotation locks the chosen orientation; a long press returns to automatic.
  const rotate = useCallback(() => {
    const next = W > H ? 'portrait' : 'landscape';
    Native?.setOrientation(next);
    toast(next === 'landscape' ? 'Paysage verrouillé — appui long pour l’auto' : 'Portrait verrouillé — appui long pour l’auto');
  }, [W, H]);
  const autoRotate = useCallback(() => {
    updateVideo({ autoRotate: true });
    Native?.setOrientation('sensor');
    toast('Rotation automatique');
  }, [updateVideo]);

  const openMenuAt = useCallback((ref: React.RefObject<View | null>, items: MenuItem[], title?: string, align: 'left' | 'right' = 'right') => {
    ref.current?.measureInWindow((x, y, w, h) => setMenu({ x: align === 'right' ? x + w : x, y: y + h, items, title }));
  }, []);

  const tracksRef = useRef<View>(null);
  const speedRef = useRef<View>(null);
  const moreRef = useRef<View>(null);

  const trackMenu = useCallback(async () => {
    await useVideo.getState().refreshTracks();
    const s = useVideo.getState();
    const items: MenuItem[] = [];
    if (s.engine === 'exo' && s.tracks) {
      const t = s.tracks;
      if (t.audio.length > 1 || t.audio.length === 1)
        t.audio.forEach((a) =>
          items.push({ label: `Son · ${a.label}`, checked: !!a.selected, hint: a.supported === false ? 'Non géré par le téléphone' : undefined, onPress: () => s.selectAudio(a.id) })
        );
      items.push({ label: 'Sous-titres désactivés', checked: !t.text.some((x) => x.selected), onPress: () => s.selectText(null) });
      t.text.forEach((x) => items.push({ label: `Sous-titres · ${x.label}`, checked: !!x.selected, onPress: () => s.selectText(x.id) }));
    } else if (s.vlcTracks) {
      const t = s.vlcTracks;
      t.audio.filter((a) => a.id !== '-1').forEach((a) => items.push({ label: `Son · ${a.label}`, checked: a.id === t.audioSelected, onPress: () => s.selectAudio(a.id) }));
      t.text.forEach((x) => items.push({ label: x.id === '-1' ? 'Sous-titres désactivés' : `Sous-titres · ${x.label}`, checked: x.id === t.textSelected, onPress: () => s.selectText(x.id === '-1' ? null : x.id) }));
    }
    if (!items.length) items.push({ label: 'Aucune autre piste dans ce fichier', onPress: () => {} });
    items.push({
      label: `Taille des sous-titres · ${Math.round(settings.subtitleScale * 100)} %`,
      onPress: () =>
        setTimeout(
          () =>
            openMenuAt(
              tracksRef,
              [0.75, 1, 1.25, 1.5, 2].map((v) => ({ label: `${Math.round(v * 100)} %`, checked: settings.subtitleScale === v, onPress: () => updateVideo({ subtitleScale: v }) })),
              'Taille des sous-titres'
            ),
          60
        ),
    });
    items.push({
      label: 'Style des sous-titres',
      onPress: () =>
        setTimeout(
          () =>
            openMenuAt(
              tracksRef,
              [
                { k: 'shadow' as const, l: 'Blanc avec ombre' },
                { k: 'box' as const, l: 'Sur fond noir' },
                { k: 'yellow' as const, l: 'Jaune contouré' },
              ].map((o) => ({ label: o.l, checked: settings.subtitleStyle === o.k, onPress: () => updateVideo({ subtitleStyle: o.k }) })),
              'Style des sous-titres'
            ),
          60
        ),
    });
    openMenuAt(tracksRef, items, 'Pistes audio et sous-titres');
  }, [openMenuAt, settings.subtitleScale, settings.subtitleStyle, updateVideo]);

  const speedMenu = useCallback(() => {
    openMenuAt(
      speedRef,
      SPEEDS.map((v) => ({ label: `${String(v).replace('.', ',')}x${v === 1 ? ' · Normale' : ''}`, checked: Math.abs(v - speed) < 0.01, onPress: () => useVideo.getState().setSpeed(v) })),
      'Vitesse de lecture'
    );
  }, [openMenuAt, speed]);

  const infoLine = useMemo(() => {
    const v = tracks?.video;
    if (engine === 'vlc') return 'Décodeur logiciel (VLC)';
    if (!v) return 'Décodeur matériel';
    const codec = (v.mime ?? '').replace('video/', '').replace('hevc', 'HEVC').replace('avc', 'H.264').toUpperCase();
    const fps = v.frameRate > 0 ? ` · ${Math.round(v.frameRate)} i/s` : '';
    return `${codec} · ${v.width}×${v.height}${fps}${v.hdr ? ' · HDR' : ''}`;
  }, [tracks, engine]);

  const moreMenu = useCallback(() => {
    const s = useVideo.getState();
    const sleepLabel = sleepEnd ? 'À la fin de la vidéo' : sleepAt ? `Dans ${Math.max(1, Math.round((sleepAt - Date.now()) / 60000))} min` : 'Désactivée';
    openMenuAt(moreRef, [
      { label: 'Capturer l’image', onPress: capture },
      { label: 'Enregistrer ce moment', onPress: addMoment },
      { label: `Boucle A–B${loopA !== null ? ' (active)' : ''}`, onPress: cycleLoop },
      { label: repeatOne ? 'Ne plus répéter cette vidéo' : 'Répéter cette vidéo', onPress: () => s.setRepeatOne(!repeatOne) },
      { label: mirror ? 'Désactiver le miroir' : 'Effet miroir', onPress: () => setMirror((m) => !m) },
      { label: audioOnly ? 'Revenir à la vidéo' : 'Son seulement (écran noir)', onPress: () => setAudioOnly((a) => !a) },
      {
        label: 'Mise en veille',
        hint: sleepLabel,
        onPress: () =>
          setTimeout(
            () =>
              openMenuAt(
                moreRef,
                [
                  { label: 'Désactivée', checked: !sleepAt && !sleepEnd, onPress: () => s.setSleep(null) },
                  ...[15, 30, 45, 60, 90].map((m) => ({ label: `${m} minutes`, onPress: () => (s.setSleep(m), toast(`Arrêt dans ${m} min`)) })),
                  { label: 'À la fin de la vidéo', checked: sleepEnd, onPress: () => s.setSleep('end') },
                ],
                'Mise en veille'
              ),
            60
          ),
      },
      {
        label: 'Décodeur',
        hint: engine === 'exo' ? 'Matériel (rapide)' : 'Logiciel (lit tout)',
        onPress: () => s.switchEngine(engine === 'exo' ? 'vlc' : 'exo', engine === 'exo' ? 'Décodeur logiciel' : 'Décodeur matériel'),
      },
      { label: settings.background ? 'Lecture en arrière-plan : oui' : 'Lecture en arrière-plan : non', onPress: () => updateVideo({ background: !settings.background }) },
      { label: settings.gestures ? 'Désactiver les gestes' : 'Activer les gestes', onPress: () => updateVideo({ gestures: !settings.gestures }) },
      { label: 'Informations', hint: infoLine, onPress: () => {} },
    ], undefined);
  }, [openMenuAt, capture, addMoment, cycleLoop, loopA, repeatOne, mirror, audioOnly, sleepAt, sleepEnd, engine, settings.background, settings.gestures, updateVideo, infoLine]);

  const momentsMenu = useCallback(() => {
    if (!item) return;
    if (!moments.length) return addMoment();
    useUI.getState().showSheet({
      title: 'Moments enregistrés',
      subtitle: item.title,
      actions: [
        { label: 'Enregistrer ce moment', icon: 'plus', onPress: addMoment },
        ...moments.map((m) => ({ label: `${fmt(m.position)} · ${m.label.replace(/^Moment à .*/, 'Moment')}`, icon: 'bookmark', onPress: () => useVideo.getState().seek(m.position) })),
        { label: 'Tout effacer', icon: 'trash', destructive: true, onPress: () => moments.forEach((m) => useMedia.getState().removeMoment(item.key, m.id)) },
      ],
    });
  }, [item, moments, addMoment]);

  if (!item) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={{ color: '#fff' }}>Aucune vidéo</Text>
      </View>
    );
  }

  const landscape = W > H;
  const padH = landscape ? Math.max(insets.left, insets.right, 16) : 14;
  const remaining = Math.max(0, duration - position);

  return (
    <View ref={rootRef} style={styles.root}>
      <StatusBar hidden />
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View style={[StyleSheet.absoluteFill, pictureStyle]}>
            {Surface && !audioOnly ? (
              <Surface
                style={StyleSheet.absoluteFill}
                engine={engine}
                resizeMode={resizeMode}
                subtitleScale={settings.subtitleScale}
                subtitleStyle={settings.subtitleStyle}
              />
            ) : null}
          </Animated.View>
          {audioOnly ? (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              {thumb ? <Image source={{ uri: thumb }} style={[StyleSheet.absoluteFill, { opacity: 0.25 }]} blurRadius={30} contentFit="cover" /> : null}
              <Icon name="headphones" size={64} color="#fff" strokeWidth={1.5} />
              <Text style={styles.audioOnly}>Son seulement</Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, flashStyle]} key={flash} />

      {ripple && !inPip ? <Ripple key={`${ripple.side}`} side={ripple.side} seconds={ripple.seconds} /> : null}
      {buffering && !error && !inPip ? <Buffering /> : null}
      {!inPip ? <GestureHud hud={hud} /> : null}

      {/* Controls */}
      {!inPip ? (
        <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents={controls && !locked ? 'box-none' : 'none'}>
          <View style={[styles.topArea, { paddingTop: landscape ? 10 : insets.top + 6, paddingHorizontal: padH }]}>
            <Gradient top />
            <View style={styles.topRow}>
              <Btn icon="chevronLeft" size={28} label="Fermer" onPress={close} />
              <View style={{ flex: 1, marginHorizontal: 6 }}>
                <Marquee text={item.title} style={styles.title} />
                <Text numberOfLines={1} style={styles.subtitle}>
                  {count > 1 ? `${index + 1}/${count} · ` : ''}
                  {infoLine}
                </Text>
              </View>
              <View ref={tracksRef} collapsable={false}>
                <Btn icon="subtitles" label="Pistes et sous-titres" onPress={trackMenu} />
              </View>
              <View ref={speedRef} collapsable={false}>
                <Btn icon="speed" label="Vitesse" onPress={speedMenu} badge={speed !== 1 ? `${String(speed).replace('.', ',')}x` : undefined} />
              </View>
              <Btn
                icon="pip"
                label="Image dans l'image"
                onPress={() => Native?.enterPip(videoW || 16, videoH || 9).then((ok) => !ok && toast("Image dans l'image indisponible"))}
              />
              <View ref={moreRef} collapsable={false}>
                <Btn icon="more" label="Plus d'options" onPress={moreMenu} />
              </View>
            </View>
          </View>

          <View style={styles.centerRow} pointerEvents="box-none">
            {frameMode ? (
              <>
                <Btn icon="frameBack" size={30} label="Image précédente" onPress={() => useVideo.getState().step(false)} onLongPress={() => useVideo.getState().seekBy(-1000)} />
                <View style={{ width: 28 }} />
              </>
            ) : null}
            <Btn icon="prev" size={30} label="Précédente" onPress={() => useVideo.getState().previous()} />
            <Pressable
              onPress={() => {
                haptic();
                useVideo.getState().toggle();
                scheduleHide();
              }}
              style={styles.playBig}
              accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}
            >
              <Icon name={ended ? 'replay10' : isPlaying ? 'pause' : 'play'} size={38} color="#fff" strokeWidth={2} />
            </Pressable>
            <Btn icon="next" size={30} label="Suivante" onPress={() => useVideo.getState().next()} />
            {frameMode ? (
              <>
                <View style={{ width: 28 }} />
                <Btn icon="frameFwd" size={30} label="Image suivante" onPress={() => useVideo.getState().step(true)} onLongPress={() => useVideo.getState().seekBy(1000)} />
              </>
            ) : null}
          </View>

          <View style={[styles.bottomArea, { paddingBottom: landscape ? 8 : insets.bottom + 8, paddingHorizontal: padH }]}>
            <Gradient top={false} />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{fmt(position, frameMode)}</Text>
              <View style={{ flex: 1 }} />
              {loopA !== null ? <Text style={styles.loopTag}>A–B</Text> : null}
              {fellBack || engine === 'vlc' ? <Text style={styles.engineTag}>SW</Text> : null}
              <Text style={styles.time} onPress={() => (setShowRemaining((r) => !r), updateVideo({ showRemaining: !showRemaining }))}>
                {showRemaining ? `−${fmt(remaining)}` : fmt(duration)}
              </Text>
            </View>
            <SeekBar
              position={position}
              duration={duration}
              uri={item.uri}
              markers={moments.map((m) => m.position)}
              loopA={loopA}
              loopB={loopB}
              accent="#FFFFFF"
              onScrubStart={() => {
                scrubbing.current = true;
                if (hideTimer.current) clearTimeout(hideTimer.current);
              }}
              onScrub={(ms) => {
                const now = Date.now();
                if (now - lastSeek.current > 120) {
                  lastSeek.current = now;
                  if (engine === 'exo') {
                    Native?.setSeekMode(false);
                    Native?.seekTo(ms);
                  } else Native?.vlcSeek(ms, true);
                }
              }}
              onScrubEnd={(ms) => {
                scrubbing.current = false;
                if (engine === 'exo') Native?.setSeekMode(true);
                useVideo.getState().seek(ms);
                scheduleHide();
              }}
            />
            <View style={styles.toolsRow}>
              <Btn icon="lock" label="Verrouiller" onPress={() => (setLocked(true), setLockHint(true), toast('Écran verrouillé'))} />
              <Btn icon="rotate" label="Pivoter" onPress={rotate} onLongPress={autoRotate} />
              <Btn icon="aspect" label="Format" onPress={cycleResize} />
              <Btn icon="camera" label="Capture" onPress={capture} />
              <Btn icon="loop" label="Boucle A-B" onPress={cycleLoop} active={loopA !== null} />
              <Btn icon="frameFwd" label="Image par image" onPress={() => (setFrameMode((f) => !f), !frameMode && useVideo.getState().pause())} active={frameMode} />
              <Btn icon={moments.length ? 'bookmarkFilled' : 'bookmark'} label="Moments" onPress={momentsMenu} onLongPress={addMoment} />
              <Btn icon="headphones" label="Son seulement" onPress={() => setAudioOnly((a) => !a)} active={audioOnly} />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* Lock */}
      {locked && lockHint && !inPip ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.lockWrap, { bottom: insets.bottom + 40 }]}>
          <Pressable
            onPress={() => {
              haptic();
              setLocked(false);
              setLockHint(false);
              showControls(true);
            }}
            style={styles.unlock}
          >
            <Icon name="unlock" size={26} color="#1A1A1A" />
            <Text style={styles.unlockText}>Déverrouiller</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Error */}
      {error ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.75)', padding: 30 }]}>
          <Icon name="info" size={44} color="#fff" />
          <Text style={styles.errorTitle}>Lecture interrompue</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
            {engine === 'exo' ? (
              <Pressable onPress={() => useVideo.getState().switchEngine('vlc', 'Décodeur logiciel activé')} style={styles.errorBtn}>
                <Text style={styles.errorBtnText}>Essayer le décodeur logiciel</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => useVideo.getState().switchEngine('exo', 'Décodeur matériel')} style={styles.errorBtn}>
                <Text style={styles.errorBtnText}>Essayer le décodeur matériel</Text>
              </Pressable>
            )}
            <Pressable onPress={close} style={[styles.errorBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={[styles.errorBtnText, { color: '#fff' }]}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PopupMenu visible={!!menu} anchor={menu ? { x: menu.x, y: menu.y, align: 'right' } : null} items={menu?.items ?? []} title={menu?.title} onClose={() => setMenu(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  topArea: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 30 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 16.5, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12.5, marginTop: 2 },
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: '#FFD25A' },
  badge: { position: 'absolute', top: 2, right: -4, backgroundColor: '#FFD25A', borderRadius: 8, paddingHorizontal: 4 },
  badgeText: { color: '#1A1300', fontSize: 10, fontWeight: '800' },
  centerRow: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: -40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  playBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomArea: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 50 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  time: { color: '#fff', fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  loopTag: { color: '#1A1300', backgroundColor: '#FFD25A', fontSize: 10.5, fontWeight: '800', borderRadius: 5, paddingHorizontal: 5, overflow: 'hidden' },
  engineTag: { color: '#fff', backgroundColor: 'rgba(255,255,255,0.22)', fontSize: 10.5, fontWeight: '800', borderRadius: 5, paddingHorizontal: 5, overflow: 'hidden' },
  toolsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  ripple: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center' },
  rippleInner: { alignItems: 'center' },
  rippleText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4 },
  lockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', height: 52, borderRadius: 26, paddingHorizontal: 22 },
  unlockText: { color: '#1A1A1A', fontSize: 16, fontWeight: '700' },
  audioOnly: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 14 },
  errorTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14 },
  errorText: { color: 'rgba(255,255,255,0.8)', fontSize: 14.5, textAlign: 'center', marginTop: 8 },
  errorBtn: { backgroundColor: '#fff', borderRadius: 22, height: 44, paddingHorizontal: 18, justifyContent: 'center' },
  errorBtnText: { color: '#111', fontSize: 14.5, fontWeight: '700' },
});
