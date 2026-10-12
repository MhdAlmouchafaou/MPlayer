import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork } from '../../../components/Artwork';
import { TrackList } from '../../../components/TrackList';
import { IconButton } from '../../../components/ui';
import { collectionActions } from '../../../lib/actions';
import { useLibrary, type Track } from '../../../store/library';
import { useUI } from '../../../store/ui';
import { useUserStore } from '../../../store/user';
import { useTheme } from '../../../theme';
import { displayFolder, folderName, formatTotal, plural } from '../../../utils';
import type { IconName } from '../../../components/Icon';

type Kind = 'album' | 'artist' | 'folder' | 'playlist' | 'smart';

const SMART_NAMES: Record<string, string> = {
  'recent-added': 'Ajouté récemment',
  'most-played': 'Les plus écoutés',
  'recent-played': 'Écoutés récemment',
};

function useCollection(type: Kind, id: string) {
  const tracks = useLibrary((s) => s.tracks);
  const byId = useLibrary((s) => s.byId);
  const albums = useLibrary((s) => s.albums);
  const playlists = useUserStore((s) => s.playlists);
  const playCounts = useUserStore((s) => s.playCounts);
  const recent = useUserStore((s) => s.recent);

  return useMemo((): { title: string; subtitle: string; list: Track[]; icon: IconName; round?: boolean } => {
    switch (type) {
      case 'album': {
        const album = albums.find((a) => a.id === id);
        const list = (album?.trackIds ?? []).map((t) => byId[t]).filter(Boolean);
        list.sort((a, b) => (a.trackNumber || 9999) - (b.trackNumber || 9999));
        return { title: album?.name ?? 'Album', subtitle: album?.artist ?? '', list, icon: 'disc' };
      }
      case 'artist': {
        const list = tracks.filter((t) => (t.artist || 'Inconnu') === id);
        return { title: id, subtitle: '', list, icon: 'person', round: true };
      }
      case 'folder': {
        const list = tracks.filter((t) => t.folder === id);
        return { title: folderName(id), subtitle: displayFolder(id), list, icon: 'folderNote' };
      }
      case 'playlist': {
        const p = playlists.find((x) => x.id === id);
        return { title: p?.name ?? 'Liste', subtitle: '', list: (p?.trackIds ?? []).map((t) => byId[t]).filter(Boolean), icon: 'note' };
      }
      case 'smart': {
        let list: Track[] = [];
        if (id === 'recent-added') {
          const sorted = [...tracks].sort((a, b) => b.dateAdded - a.dateAdded);
          const cutoff = Date.now() / 1000 - 90 * 24 * 3600;
          list = sorted.filter((t) => t.dateAdded >= cutoff);
          if (list.length < 20) list = sorted.slice(0, 100);
        } else if (id === 'most-played') {
          list = tracks
            .filter((t) => (playCounts[t.id] ?? 0) > 0)
            .sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0))
            .slice(0, 100);
        } else {
          list = recent.map((r) => byId[r]).filter(Boolean);
        }
        return { title: SMART_NAMES[id] ?? 'Liste', subtitle: '', list, icon: 'note' };
      }
    }
  }, [type, id, tracks, byId, albums, playlists, playCounts, recent]);
}

export default function CollectionScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type: Kind; id: string }>();
  const type = params.type;
  const id = params.id;
  const { title, subtitle, list, icon, round } = useCollection(type, id);
  const playCounts = useUserStore((s) => s.playCounts);
  const duration = useMemo(() => list.reduce((a, x) => a + x.duration, 0), [list]);
  const playlist = useUserStore((s) => (type === 'playlist' ? s.playlists.find((p) => p.id === id) : undefined));
  const moreRef = useRef<View>(null);

  const meta = [subtitle, plural(list.length, 'piste', 'pistes'), list.length ? formatTotal(duration) : '']
    .filter(Boolean)
    .join(' · ');

  const header = (
    <View style={styles.hero}>
      <Artwork trackId={list[0]?.id} albumId={list[0]?.albumId} size={176} radius={round ? 88 : 30} icon={icon} quality={512} />
      <Text numberOfLines={2} style={[styles.title, { color: t.text }]}>
        {title}
      </Text>
      <Text numberOfLines={2} style={[styles.meta, { color: t.textSecondary }]}>
        {meta}
      </Text>
    </View>
  );

  const openMenu = () => {
    const extra =
      type === 'playlist' && playlist
        ? [
            {
              label: 'Renommer',
              icon: 'edit',
              onPress: () =>
                useUI.getState().showPrompt({
                  title: 'Renommer la liste',
                  initial: playlist.name,
                  confirmLabel: 'Renommer',
                  onSubmit: (name: string) => useUserStore.getState().renamePlaylist(playlist.id, name),
                }),
            },
            {
              label: 'Supprimer la liste',
              icon: 'trash',
              destructive: true,
              onPress: () =>
                useUI.getState().showConfirm({
                  title: `Supprimer « ${playlist.name} » ?`,
                  message: 'Les fichiers audio ne seront pas supprimés.',
                  confirmLabel: 'Supprimer',
                  destructive: true,
                  onConfirm: () => {
                    useUserStore.getState().deletePlaylist(playlist.id);
                    router.back();
                  },
                }),
            },
          ]
        : type === 'smart' && id === 'recent-played'
          ? [
              {
                label: "Effacer l'historique",
                icon: 'trash',
                destructive: true,
                onPress: () => useUserStore.getState().clearHistory(),
              },
            ]
          : [];
    useUI.getState().showSheet({ title, subtitle: meta, actions: collectionActions(list, extra) });
  };

  const sortable = type !== 'playlist' && type !== 'smart';

  return (
    <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton name="chevronLeft" size={26} color={t.icon} label="Retour" onPress={() => router.back()} />
        <Text numberOfLines={1} style={[styles.barTitle, { color: t.text }]}>
          {title}
        </Text>
        <View ref={moreRef} collapsable={false}>
          <IconButton name="more" size={24} color={t.icon} label="Options" onPress={openMenu} disabled={!list.length && type !== 'playlist'} />
        </View>
      </View>
      <TrackList
        tracks={list}
        listKey={`${type}`}
        header={header}
        sortable={sortable}
        defaultSort={type === 'album' ? { key: 'album', desc: false } : { key: 'name', desc: false }}
        sortKeys={type === 'album' ? ['album', 'name', 'duration'] : ['name', 'dateAdded', 'artist', 'album', 'duration']}
        playlistId={type === 'playlist' ? id : undefined}
        alphabet={false}
        subtitle={
          type === 'artist'
            ? (x) => x.album || 'Inconnu'
            : type === 'smart' && id === 'most-played'
              ? (x) => `${x.artist || 'Inconnu'} · ${plural(playCounts[x.id] ?? 0, 'lecture', 'lectures')}`
              : undefined
        }
        emptyText={type === 'playlist' ? 'Cette liste est vide.\nAjoutez des pistes depuis leur menu.' : 'Aucune piste'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  barTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 25,
    fontWeight: '600',
    marginTop: 18,
    textAlign: 'center',
  },
  meta: {
    fontSize: 14.5,
    marginTop: 6,
    textAlign: 'center',
  },
});
