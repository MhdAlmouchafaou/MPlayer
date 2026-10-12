import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useEvent, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { AlbumsTab, ArtistsTab, FavoritesTab, FoldersTab, PlaylistsTab, TracksTab } from '../components/LibraryTabs';
import { PopupMenu, type MenuItem } from '../components/PopupMenu';
import { TabsHeader } from '../components/TabsHeader';
import { IconButton } from '../components/ui';
import { createPlaylistFlow } from '../lib/actions';
import { useLibrary } from '../store/library';
import { toast } from '../store/ui';
import { TAB_LABELS, useUserStore, type TabKey } from '../store/user';
import { fonts, useTheme } from '../theme';

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

/** Pager scroll position forwarded to a shared value on the UI thread (no JS round-trip). */
function usePageScroll(onScroll: (position: number, offset: number) => void) {
  return useEvent<{ position: number; offset: number }>(
    (e) => {
      'worklet';
      onScroll(e.position, e.offset);
    },
    ['onPageScroll']
  );
}

const TAB_COMPONENTS: Record<TabKey, React.ComponentType> = {
  favorites: FavoritesTab,
  playlists: PlaylistsTab,
  tracks: TracksTab,
  albums: AlbumsTab,
  artists: ArtistsTab,
  folders: FoldersTab,
};

function PermissionGate() {
  const t = useTheme();
  const permission = useLibrary((s) => s.permission);
  const request = useLibrary((s) => s.requestPermission);
  const blocked = permission === 'blocked';
  return (
    <View style={styles.gate}>
      <View style={[styles.gateIcon, { backgroundColor: t.accentTrack }]}>
        <Icon name="note" size={46} color={t.accent} strokeWidth={2.2} />
      </View>
      <Text style={[styles.gateTitle, { color: t.text }]}>Accédez à votre musique</Text>
      <Text style={[styles.gateText, { color: t.textSecondary }]}>
        MPlayer a besoin de l'autorisation de lire les fichiers audio de votre téléphone pour afficher et lire votre bibliothèque.
      </Text>
      <Pressable
        onPress={() => (blocked ? Linking.openSettings() : request())}
        style={[styles.gateButton, { backgroundColor: t.accent }]}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      >
        <Text style={styles.gateButtonText}>{blocked ? 'Ouvrir les paramètres' : 'Autoriser l’accès'}</Text>
      </Pressable>
      {blocked ? (
        <Text style={[styles.gateHint, { color: t.textSecondary }]}>
          Dans Autorisations, activez « Musique et audio », puis revenez dans l'application.
        </Text>
      ) : null}
    </View>
  );
}

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const permission = useLibrary((s) => s.permission);
  const loading = useLibrary((s) => s.loading);
  const loaded = useLibrary((s) => s.loaded);
  const tabsSetting = useUserStore((s) => s.settings.tabs);
  const tabs = useMemo(() => {
    const visible = tabsSetting.filter((x) => x.visible).map((x) => x.key);
    return visible.length ? visible : (['tracks'] as TabKey[]);
  }, [tabsSetting]);

  const initial = Math.max(0, tabs.indexOf('tracks'));
  const [page, setPage] = useState(initial);
  const position = useSharedValue(initial);
  const pager = useRef<PagerView>(null);
  const scrolling = useSharedValue(false);
  const pageScroll = usePageScroll((p, o) => {
    'worklet';
    scrolling.value = true;
    position.value = p + o;
  });
  const moreRef = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const current = tabs[page] ?? 'tracks';

  const menuItems: MenuItem[] = [
    ...(current === 'playlists' ? [{ label: 'Nouvelle liste de lecture', onPress: () => createPlaylistFlow() }] : []),
    ...(current === 'folders' ? [{ label: 'Masquer les dossiers', onPress: () => router.push('/hidden-folders') }] : []),
    {
      label: 'Actualiser la bibliothèque',
      onPress: async () => {
        await useLibrary.getState().scan();
        toast(`${useLibrary.getState().tracks.length} pistes trouvées`);
      },
    },
    { label: 'Qualité et effets sonores', onPress: () => router.push('/equalizer') },
    { label: 'Paramètres', onPress: () => router.push('/settings') },
  ];

  const granted = permission === 'granted';

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: t.brand, fontFamily: fonts.brand }]}>MPlayer</Text>
        <View style={{ flex: 1 }} />
        {granted ? (
          <>
            {current === 'playlists' ? (
              <IconButton name="plus" size={30} color={t.brand} strokeWidth={1.7} label="Nouvelle liste" onPress={() => createPlaylistFlow()} />
            ) : null}
            <IconButton name="search" size={28} color={t.brand} strokeWidth={1.8} label="Rechercher" onPress={() => router.push('/search')} />
            <View ref={moreRef} collapsable={false}>
              <IconButton
                name="more"
                size={26}
                color={t.brand}
                label="Plus d'options"
                onPress={() => moreRef.current?.measureInWindow((x, y, w, h) => setMenu({ x: x + w - 4, y: y + h - 6 }))}
              />
            </View>
          </>
        ) : null}
      </View>

      {granted ? (
        <>
          <TabsHeader
            labels={tabs.map((k) => TAB_LABELS[k])}
            position={position}
            onPress={(i) => pager.current?.setPage(i)}
          />
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            {loading && !loaded ? (
              <ActivityIndicator style={{ marginTop: 80 }} color={t.accent} size="large" />
            ) : (
              <AnimatedPager
                ref={pager}
                style={{ flex: 1 }}
                initialPage={initial}
                offscreenPageLimit={1}
                onPageScroll={pageScroll as never}
                onPageSelected={(e: { nativeEvent: { position: number } }) => {
                  const i = e.nativeEvent.position;
                  setPage(i);
                  // Safety net if scroll events were not delivered: settle the tab strip.
                  if (Math.abs(position.value - i) > 0.01) position.value = withTiming(i, { duration: 220 });
                }}
              >
                {tabs.map((key) => {
                  const Component = TAB_COMPONENTS[key];
                  return (
                    <View key={key} style={{ flex: 1 }} collapsable={false}>
                      <Component />
                    </View>
                  );
                })}
              </AnimatedPager>
            )}
          </View>
        </>
      ) : permission === 'unknown' ? null : (
        <PermissionGate />
      )}

      <PopupMenu visible={!!menu} anchor={menu ? { ...menu, align: 'right' } : null} items={menuItems} onClose={() => setMenu(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
    paddingRight: 8,
    marginTop: 6,
  },
  brand: {
    fontSize: 27,
    letterSpacing: -0.4,
  },
  card: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    paddingBottom: 60,
  },
  gateIcon: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  gateTitle: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  gateText: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
  },
  gateButton: {
    marginTop: 30,
    height: 52,
    paddingHorizontal: 30,
    borderRadius: 26,
    justifyContent: 'center',
  },
  gateButtonText: {
    color: '#fff',
    fontSize: 16.5,
    fontWeight: '600',
  },
  gateHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});
