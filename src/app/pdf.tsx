import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Native, type PdfInfo } from '../../modules/mplayer-core';
import { Icon } from '../components/Icon';
import { PopupMenu, type MenuItem } from '../components/PopupMenu';
import { haptic, IconButton } from '../components/ui';
import { useMedia } from '../store/media';
import { toast, useUI } from '../store/ui';
import { useTheme } from '../theme';

const GAP = 10;

type PageProps = { uri: string; index: number; width: number; height: number; renderWidth: number; mode: number; visible: boolean; dark: boolean };

const Page = memo(function Page({ uri, index, width, height, renderWidth, mode, visible, dark }: PageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [hi, setHi] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !Native) return;
    let alive = true;
    // Quick low-resolution pass first, then the sharp one.
    const low = Math.min(600, renderWidth);
    Native.pdfRender(uri, index, low, mode)
      .then((u) => {
        if (!alive) return;
        setSrc(u);
        if (renderWidth > low) return Native!.pdfRender(uri, index, renderWidth, mode).then((h) => alive && setHi(h));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uri, index, renderWidth, mode, visible]);
  useEffect(() => setHi(null), [renderWidth, mode]);
  return (
    <View style={[styles.page, { width, height, backgroundColor: dark ? '#1E1D1B' : '#FFFFFF' }]}>
      {src ? <Image source={{ uri: hi ?? src }} style={StyleSheet.absoluteFill} contentFit="fill" transition={hi ? 0 : 120} /> : null}
      {!src ? <ActivityIndicator style={StyleSheet.absoluteFill} color={dark ? '#777' : '#B5B9C2'} /> : null}
    </View>
  );
});

export default function PdfReader() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const params = useLocalSearchParams<{ uri: string; name?: string }>();
  const uri = params.uri;
  const name = (params.name ?? decodeURIComponent(uri?.split('/').pop() ?? 'Document')).replace(/\.pdf$/i, '');
  const settings = useMedia((s) => s.pdf);
  const updatePdf = useMedia((s) => s.updatePdf);
  const bookmarks = useMedia((s) => s.docBookmarks[uri] ?? []);
  const favorite = useMedia((s) => s.docFavorites.includes(uri));
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState<Set<number>>(new Set([0, 1]));
  const [chrome, setChrome] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; title?: string } | null>(null);
  const list = useRef<FlatList<number>>(null);
  const moreRef = useRef<View>(null);
  const restored = useRef(false);
  const night = settings.mode === 1;
  const horizontal = settings.horizontal;

  // --- open document ---
  useEffect(() => {
    if (!Native || !uri) return;
    let alive = true;
    Native.pdfOpen(uri)
      .then((i) => {
        if (!alive) return;
        setInfo(i);
        useMedia.getState().touchDoc({ uri, name: params.name ?? name, page: 0, pages: i.pageCount });
      })
      .catch((e) => alive && setError(String(e?.message ?? e).replace(/^.*Exception: /, '')));
    if (settings.keepAwake) Native.setKeepAwake(true);
    return () => {
      alive = false;
      Native!.pdfClose(uri);
      Native!.setKeepAwake(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  // --- layout ---
  const pageW = horizontal ? W : W - 16;
  const sizes = useMemo(() => {
    if (!info) return [];
    return info.pages.map((p) => {
      if (horizontal) {
        const availH = H - (insets.top + insets.bottom);
        const scale = Math.min(W / p.w, availH / p.h);
        return { w: p.w * scale, h: p.h * scale };
      }
      return { w: pageW, h: (pageW * p.h) / p.w };
    });
  }, [info, pageW, horizontal, W, H, insets.top, insets.bottom]);
  const offsets = useMemo(() => {
    const o: number[] = [];
    let acc = horizontal ? 0 : insets.top + 64;
    for (const s of sizes) {
      o.push(acc);
      acc += horizontal ? W : s.h + GAP;
    }
    return o;
  }, [sizes, horizontal, W, insets.top]);
  const renderWidth = Math.min(2400, Math.round(pageW * PixelRatio.get() * Math.min(zoomLevel, 2.5)));

  const pages = useMemo(() => (info ? Array.from({ length: info.pageCount }, (_, i) => i) : []), [info]);

  // Resume at the last page read.
  useEffect(() => {
    if (!info || restored.current) return;
    restored.current = true;
    const last = useMedia.getState().docRecents.find((r) => r.uri === uri)?.page ?? 0;
    if (last > 0 && last < info.pageCount) {
      setTimeout(() => {
        list.current?.scrollToIndex({ index: last, animated: false });
        toast(`Reprise à la page ${last + 1}`);
      }, 120);
    }
  }, [info, uri]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!viewableItems.length) return;
    const idx = viewableItems.map((v) => v.index ?? 0);
    const first = Math.min(...idx);
    const last = Math.max(...idx);
    setVisible(new Set([first - 1, ...idx, last + 1]));
    setPage(first);
  }).current;

  useEffect(() => {
    if (info) useMedia.getState().setDocPage(uri, page, info.pageCount);
  }, [page, info, uri]);

  // --- zoom (vertical mode) ---
  const scale = useSharedValue(1);
  const scaleStart = useSharedValue(1);
  const tx = useSharedValue(0);
  const txStart = useSharedValue(0);
  const commitZoom = useCallback((z: number) => setZoomLevel(z), []);
  const toggleChrome = useCallback(() => setChrome((c) => !c), []);

  const pinch = Gesture.Pinch()
    .enabled(!horizontal)
    .onStart(() => {
      scaleStart.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(5, scaleStart.value * e.scale));
      const maxX = (W * (scale.value - 1)) / 2;
      tx.value = Math.max(-maxX, Math.min(maxX, tx.value));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        tx.value = withSpring(0);
      }
      scheduleOnRN(commitZoom, scale.value < 1.05 ? 1 : scale.value);
    });
  const panX = Gesture.Pan()
    .enabled(!horizontal)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      txStart.value = tx.value;
    })
    .onUpdate((e) => {
      const maxX = (W * (scale.value - 1)) / 2;
      tx.value = Math.max(-maxX, Math.min(maxX, txStart.value + e.translationX));
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, ok) => {
      if (!ok || horizontal) return;
      if (scale.value > 1.05) {
        scale.value = withSpring(1);
        tx.value = withSpring(0);
        scheduleOnRN(commitZoom, 1);
      } else {
        scale.value = withSpring(2.2);
        tx.value = withSpring(Math.max(-W * 0.6, Math.min(W * 0.6, (W / 2 - e.x) * 1.2)));
        scheduleOnRN(commitZoom, 2.2);
      }
    });
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(toggleChrome);
  });
  const gesture = Gesture.Simultaneous(pinch, panX, Gesture.Exclusive(doubleTap, tap));

  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { scale: scale.value }] }));
  const chromeOpacity = useSharedValue(1);
  useEffect(() => {
    chromeOpacity.value = withTiming(chrome ? 1 : 0, { duration: 200 });
  }, [chrome, chromeOpacity]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));

  const goTo = useCallback(
    (p: number) => {
      if (!info) return;
      const i = Math.max(0, Math.min(info.pageCount - 1, p));
      list.current?.scrollToIndex({ index: i, animated: Math.abs(i - page) < 6 });
    },
    [info, page]
  );

  const askPage = () =>
    useUI.getState().showPrompt({
      title: 'Aller à la page',
      placeholder: `1 – ${info?.pageCount ?? 1}`,
      initial: String(page + 1),
      confirmLabel: 'Aller',
      onSubmit: (v) => {
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) goTo(n - 1);
      },
    });

  const showBookmarks = () =>
    useUI.getState().showSheet({
      title: 'Marque-pages',
      subtitle: name,
      actions: bookmarks.length
        ? bookmarks.map((b) => ({ label: `Page ${b + 1}`, icon: 'bookmarkFilled', onPress: () => goTo(b) }))
        : [{ label: 'Aucun marque-page pour le moment', icon: 'bookmark', onPress: () => {} }],
    });

  const more = () =>
    moreRef.current?.measureInWindow((x, y, w, h) =>
      setMenu({
        x: x + w,
        y: y + h,
        items: [
          { label: 'Aller à la page…', onPress: askPage },
          { label: 'Marque-pages', hint: bookmarks.length ? `${bookmarks.length}` : undefined, onPress: showBookmarks },
          { label: 'Lecture normale', checked: settings.mode === 0, onPress: () => updatePdf({ mode: 0 }) },
          { label: 'Mode nuit', checked: settings.mode === 1, onPress: () => updatePdf({ mode: 1 }) },
          { label: 'Mode sépia (repos des yeux)', checked: settings.mode === 2, onPress: () => updatePdf({ mode: 2 }) },
          { label: horizontal ? 'Défilement vertical' : 'Page par page (horizontal)', onPress: () => updatePdf({ horizontal: !horizontal }) },
          { label: settings.keepAwake ? 'Laisser l’écran s’éteindre' : 'Garder l’écran allumé', onPress: () => { updatePdf({ keepAwake: !settings.keepAwake }); Native?.setKeepAwake(!settings.keepAwake); } },
          { label: favorite ? 'Retirer des favoris' : 'Ajouter aux favoris', onPress: () => useMedia.getState().toggleDocFavorite(uri) },
          { label: 'Partager', onPress: () => Native?.shareFile(uri, 'application/pdf', name) },
        ],
      })
    );

  const bg = night ? '#121110' : settings.mode === 2 ? '#E9E0CC' : t.dark ? '#0F1013' : '#E6E8EC';
  const marked = bookmarks.includes(page);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style={night || t.dark ? 'light' : 'dark'} hidden={!chrome} />
      {error ? (
        <View style={styles.center}>
          <Icon name="doc" size={48} color={t.textTertiary} />
          <Text style={[styles.error, { color: t.text }]}>{error}</Text>
          <Pressable onPress={() => router.back()} style={[styles.errorBtn, { backgroundColor: t.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retour</Text>
          </Pressable>
        </View>
      ) : !info ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, zoomStyle]}>
            <FlatList
              ref={list}
              data={pages}
              horizontal={horizontal}
              pagingEnabled={horizontal}
              key={horizontal ? 'h' : 'v'}
              keyExtractor={(i) => String(i)}
              getItemLayout={(_, i) => ({ length: horizontal ? W : (sizes[i]?.h ?? 0) + GAP, offset: offsets[i] ?? 0, index: i })}
              ListHeaderComponent={horizontal ? null : <View style={{ height: insets.top + 64 }} />}
              ListFooterComponent={horizontal ? null : <View style={{ height: insets.bottom + 90 }} />}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={5}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={horizontal ? { width: W, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top } : { alignItems: 'center', marginBottom: GAP }}>
                  <Page
                    uri={uri}
                    index={item}
                    width={sizes[item].w}
                    height={sizes[item].h}
                    renderWidth={renderWidth}
                    mode={settings.mode}
                    visible={visible.has(item)}
                    dark={night}
                  />
                </View>
              )}
            />
          </Animated.View>
        </GestureDetector>
      )}

      {/* Top bar */}
      <Animated.View
        pointerEvents={chrome ? 'box-none' : 'none'}
        style={[styles.top, { paddingTop: insets.top, backgroundColor: night ? 'rgba(18,17,16,0.94)' : t.dark ? 'rgba(15,16,19,0.94)' : 'rgba(249,250,252,0.96)' }, chromeStyle]}
      >
        <IconButton name="chevronLeft" size={26} color={night ? '#EEE' : t.icon} label="Retour" onPress={() => router.back()} />
        <View style={{ flex: 1, marginHorizontal: 4 }}>
          <Text numberOfLines={1} style={{ color: night ? '#EEE' : t.text, fontSize: 16.5, fontWeight: '600' }}>
            {name}
          </Text>
          {info ? (
            <Text style={{ color: night ? '#AAA' : t.textSecondary, fontSize: 13 }}>
              Page {page + 1} sur {info.pageCount}
            </Text>
          ) : null}
        </View>
        <IconButton
          name={settings.mode === 1 ? 'sun' : 'moon'}
          size={23}
          color={night ? '#EEE' : t.icon}
          label="Mode nuit"
          onPress={() => updatePdf({ mode: settings.mode === 1 ? 0 : 1 })}
        />
        <IconButton
          name={marked ? 'bookmarkFilled' : 'bookmark'}
          size={23}
          color={marked ? t.accent : night ? '#EEE' : t.icon}
          label="Marque-page"
          onPress={() => {
            haptic();
            toast(useMedia.getState().toggleDocBookmark(uri, page) ? `Page ${page + 1} marquée` : 'Marque-page retiré');
          }}
        />
        <View ref={moreRef} collapsable={false}>
          <IconButton name="more" size={23} color={night ? '#EEE' : t.icon} label="Options" onPress={more} />
        </View>
      </Animated.View>

      {/* Page pill + quick jump */}
      {info && chrome ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.bottom, { bottom: insets.bottom + 18 }]}>
          <Pressable onPress={() => goTo(page - 1)} style={styles.pillBtn} hitSlop={6}>
            <Icon name="chevronLeft" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={askPage}>
            <Text style={styles.pillText}>
              {page + 1} / {info.pageCount}
            </Text>
          </Pressable>
          <Pressable onPress={() => goTo(page + 1)} style={styles.pillBtn} hitSlop={6}>
            <Icon name="chevronRight" size={20} color="#fff" />
          </Pressable>
          {zoomLevel > 1 ? (
            <Pressable
              onPress={() => {
                scale.value = withSpring(1);
                tx.value = withSpring(0);
                setZoomLevel(1);
              }}
              style={[styles.pillBtn, { marginLeft: 4 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{Math.round(zoomLevel * 100)}%</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      <PopupMenu visible={!!menu} anchor={menu ? { x: menu.x, y: menu.y, align: 'right' } : null} items={menu?.items ?? []} title={menu?.title} onClose={() => setMenu(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  error: { fontSize: 16, textAlign: 'center', marginTop: 14 },
  errorBtn: { marginTop: 20, height: 44, paddingHorizontal: 24, borderRadius: 22, justifyContent: 'center' },
  page: {
    overflow: 'hidden',
    borderRadius: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6 },
  bottom: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,31,36,0.88)',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 6,
  },
  pillBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pillText: { color: '#fff', fontSize: 15.5, fontWeight: '700', marginHorizontal: 10, fontVariant: ['tabular-nums'] },
});
