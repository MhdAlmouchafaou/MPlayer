import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, NAV_HEIGHT } from '../components/BottomNav';
import { BrandLogo } from '../components/BrandLogo';
import { AllDocsTab, FavoriteDocsTab, pickDocument, RecentDocsTab } from '../components/docs/DocTabs';
import { Icon, type IconName } from '../components/Icon';
import { AlbumsTab, ArtistsTab, FavoritesTab, FoldersTab, PlaylistsTab, TracksTab } from '../components/LibraryTabs';
import { PopupMenu, type MenuItem } from '../components/PopupMenu';
import { SectionPager } from '../components/SectionPager';
import { IconButton } from '../components/ui';
import { AllVideosTab, HistoryTab, VideoFavoritesTab, VideoFoldersTab } from '../components/video/VideoTabs';
import { createPlaylistFlow } from '../lib/actions';
import { requestMedia } from '../lib/permissions';
import { useDocs } from '../store/docs';
import { useLibrary } from '../store/library';
import { useMedia, type Section } from '../store/media';
import { toast, useUI } from '../store/ui';
import { TAB_LABELS, useUserStore, type TabKey } from '../store/user';
import { useVideos } from '../store/videos';
import { fonts, useTheme } from '../theme';

const MUSIC_TABS: Record<TabKey, React.ComponentType> = {
  favorites: FavoritesTab,
  playlists: PlaylistsTab,
  tracks: TracksTab,
  albums: AlbumsTab,
  artists: ArtistsTab,
  folders: FoldersTab,
};

async function grantMedia() {
  const res = await requestMedia();
  if (res.audio === 'blocked' && res.video === 'blocked') return Linking.openSettings();
  const lib = useLibrary.getState();
  const vids = useVideos.getState();
  await Promise.all([lib.checkPermission(), vids.checkPermission()]);
  if (useLibrary.getState().permission === 'granted') lib.scan();
  if (useVideos.getState().permission === 'granted') vids.scan();
}

function Gate({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.gate}>
      <View style={[styles.gateIcon, { backgroundColor: t.accentTrack }]}>
        <Icon name={icon} size={46} color={t.accent} strokeWidth={2} />
      </View>
      <Text style={[styles.gateTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.gateText, { color: t.textSecondary }]}>{text}</Text>
      <Pressable onPress={grantMedia} style={[styles.gateButton, { backgroundColor: t.accent }]} android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
        <Text style={styles.gateButtonText}>Autoriser l’accès</Text>
      </Pressable>
      <Text onPress={() => Linking.openSettings()} style={[styles.gateHint, { color: t.accent }]}>
        Ouvrir les paramètres de l’application
      </Text>
    </Animated.View>
  );
}

function VideoSection() {
  const permission = useVideos((s) => s.permission);
  const tab = useMedia.getState().videoTab;
  if (permission === 'unknown') return <View style={{ flex: 1 }} />;
  if (permission !== 'granted')
    return <Gate icon="video" title="Vos vidéos, toutes lisibles" text="MPlayer a besoin d’accéder aux vidéos du téléphone pour les afficher et les lire, quel que soit leur format." />;
  return (
    <SectionPager
      labels={['Vidéos', 'Dossiers', 'Historique', 'Favoris']}
      initial={tab}
      onChange={(i) => useMedia.setState({ videoTab: i })}
      pages={[<AllVideosTab key="a" />, <VideoFoldersTab key="f" />, <HistoryTab key="h" />, <VideoFavoritesTab key="v" />]}
    />
  );
}

function MusicSection({ onTab }: { onTab: (k: TabKey) => void }) {
  const permission = useLibrary((s) => s.permission);
  const tabsSetting = useUserStore((s) => s.settings.tabs);
  const tabs = useMemo(() => {
    const visible = tabsSetting.filter((x) => x.visible).map((x) => x.key);
    return visible.length ? visible : (['tracks'] as TabKey[]);
  }, [tabsSetting]);
  if (permission === 'unknown') return <View style={{ flex: 1 }} />;
  if (permission !== 'granted')
    return <Gate icon="note" title="Accédez à votre musique" text="MPlayer a besoin de l’autorisation de lire les fichiers audio pour afficher et lire votre bibliothèque." />;
  const initial = Math.max(0, tabs.indexOf('tracks'));
  return (
    <SectionPager
      key={tabs.join(',')}
      labels={tabs.map((k) => TAB_LABELS[k])}
      initial={initial}
      onChange={(i) => onTab(tabs[i])}
      pages={tabs.map((k) => {
        const C = MUSIC_TABS[k];
        return <C key={k} />;
      })}
    />
  );
}

function DocSection() {
  return (
    <SectionPager
      labels={['Documents', 'Récents', 'Favoris']}
      initial={useMedia.getState().docTab}
      onChange={(i) => useMedia.setState({ docTab: i })}
      pages={[<AllDocsTab key="a" />, <RecentDocsTab key="r" />, <FavoriteDocsTab key="f" />]}
    />
  );
}

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const section = useMedia((s) => s.section);
  const setSection = useMedia((s) => s.setSection);
  const [musicTab, setMusicTab] = useState<TabKey>('tracks');
  // Sections are mounted on first visit, then kept alive to preserve scroll and tab.
  const [visited, setVisited] = useState<Record<Section, boolean>>({ videos: section === 'videos', music: section === 'music', docs: section === 'docs' });
  const moreRef = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      useUI.getState().setBottomInset(NAV_HEIGHT);
      return () => useUI.getState().setBottomInset(0);
    }, [])
  );

  const change = (s: Section) => {
    setVisited((v) => ({ ...v, [s]: true }));
    setSection(s);
    if (s === 'docs' && !useDocs.getState().loaded) useDocs.getState().scan();
  };

  const menuItems: MenuItem[] =
    section === 'music'
      ? [
          ...(musicTab === 'playlists' ? [{ label: 'Nouvelle liste de lecture', onPress: () => createPlaylistFlow() }] : []),
          ...(musicTab === 'folders' ? [{ label: 'Masquer des dossiers', onPress: () => router.push('/hidden-folders') }] : []),
          {
            label: 'Actualiser la musique',
            onPress: async () => {
              await useLibrary.getState().scan();
              toast(`${useLibrary.getState().tracks.length} pistes trouvées`);
            },
          },
          { label: 'Égaliseur et effets', onPress: () => router.push('/equalizer') },
          { label: 'Paramètres', onPress: () => router.push('/settings') },
        ]
      : section === 'videos'
        ? [
            {
              label: 'Actualiser les vidéos',
              onPress: async () => {
                await useVideos.getState().scan();
                toast(`${useVideos.getState().videos.length} vidéos trouvées`);
              },
            },
            { label: 'Ouvrir un flux réseau', onPress: () => router.push('/stream') },
            { label: 'Paramètres de lecture', onPress: () => router.push('/settings') },
          ]
        : [
            { label: 'Ouvrir un fichier PDF', onPress: pickDocument },
            {
              label: 'Actualiser les documents',
              onPress: async () => {
                await useDocs.getState().scan();
                toast(`${useDocs.getState().docs.length} documents trouvés`);
              },
            },
            { label: 'Paramètres', onPress: () => router.push('/settings') },
          ];

  const show = (s: Section) => (section === s ? styles.fill : styles.hidden);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BrandLogo size={26} color={t.brand} />
        <Text style={[styles.brand, { color: t.brand, fontFamily: fonts.brand }]}>MPlayer</Text>
        <View style={{ flex: 1 }} />
        {section === 'music' && musicTab === 'playlists' ? (
          <IconButton name="plus" size={30} color={t.brand} strokeWidth={1.7} label="Nouvelle liste" onPress={() => createPlaylistFlow()} />
        ) : null}
        {section === 'docs' ? (
          <IconButton name="fileOpen" size={27} color={t.brand} strokeWidth={1.7} label="Ouvrir un fichier" onPress={pickDocument} />
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
      </View>

      <View style={styles.fill}>
        <View style={show('videos')}>{visited.videos || section === 'videos' ? <VideoSection /> : null}</View>
        <View style={show('music')}>{visited.music || section === 'music' ? <MusicSection onTab={setMusicTab} /> : null}</View>
        <View style={show('docs')}>{visited.docs || section === 'docs' ? <DocSection /> : null}</View>
      </View>

      <BottomNav section={section} onChange={change} />
      <PopupMenu visible={!!menu} anchor={menu ? { ...menu, align: 'right' } : null} items={menuItems} onClose={() => setMenu(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    marginTop: 4,
  },
  brand: { fontSize: 26, letterSpacing: -0.4, marginLeft: 9 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 60 },
  gateIcon: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  gateTitle: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  gateText: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 12 },
  gateButton: { marginTop: 30, height: 52, paddingHorizontal: 30, borderRadius: 26, justifyContent: 'center' },
  gateButtonText: { color: '#fff', fontSize: 16.5, fontWeight: '600' },
  gateHint: { fontSize: 14.5, textAlign: 'center', marginTop: 18, fontWeight: '600' },
});
