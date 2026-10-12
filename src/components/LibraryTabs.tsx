import React, { useCallback, useMemo, useRef } from 'react';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collectionActions, createPlaylistFlow, hideFolder, openCollection } from '../lib/actions';
import { letterIndex } from '../lib/sorting';
import { tracksFromIds, useLibrary, type Album, type Artist, type Folder } from '../store/library';
import { useUI } from '../store/ui';
import { useUserStore, type Playlist } from '../store/user';
import { useTheme } from '../theme';
import { plural, sortByName } from '../utils';
import { AlphabetScroller } from './AlphabetScroller';
import { Artwork } from './Artwork';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { CollectionRow, ROW_HEIGHT } from './rows';
import { MINI_SPACE, TrackList } from './TrackList';

function useSmartLists() {
  const tracks = useLibrary((s) => s.tracks);
  const playCounts = useUserStore((s) => s.playCounts);
  const recent = useUserStore((s) => s.recent);
  return useMemo(() => {
    const byDate = [...tracks].sort((a, b) => b.dateAdded - a.dateAdded);
    const cutoff = Date.now() / 1000 - 90 * 24 * 3600;
    let added = byDate.filter((t) => t.dateAdded >= cutoff);
    if (added.length < 20) added = byDate.slice(0, 100);
    const most = tracks
      .filter((t) => (playCounts[t.id] ?? 0) > 0)
      .sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0))
      .slice(0, 100);
    const ids = new Set(tracks.map((t) => t.id));
    const recentIds = recent.filter((id) => ids.has(id));
    return [
      { id: 'recent-added', name: 'Ajouté récemment', trackIds: added.map((t) => t.id) },
      { id: 'most-played', name: 'Les plus écoutés', trackIds: most.map((t) => t.id) },
      { id: 'recent-played', name: 'Écoutés récemment', trackIds: recentIds },
    ];
  }, [tracks, playCounts, recent]);
}

export function FavoritesTab() {
  const favorites = useUserStore((s) => s.favorites);
  const byId = useLibrary((s) => s.byId);
  const tracks = useMemo(() => favorites.map((id) => byId[id]).filter(Boolean), [favorites, byId]);
  return (
    <TrackList
      tracks={tracks}
      listKey="favorites"
      defaultSort={{ key: 'dateAdded', desc: false }}
      emptyText={'Appuyez sur le cœur d’un morceau\npour l’ajouter à vos favoris.'}
    />
  );
}

export function TracksTab() {
  const tracks = useLibrary((s) => s.tracks);
  return <TrackList tracks={tracks} listKey="tracks" emptyText="Aucun fichier audio trouvé sur cet appareil." />;
}

function PlaylistCard({ name, count, coverId, onPress, onLongPress, size }: { name: string; count: number; coverId?: string; onPress: () => void; onLongPress?: () => void; size: number }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ width: size, alignItems: 'center' }}>
      <Artwork trackId={coverId} size={size} radius={24} />
      <Text numberOfLines={1} style={[styles.cardTitle, { color: t.text }]}>
        {name}
      </Text>
      <Text style={[styles.cardSub, { color: t.textSecondary }]}>{plural(count, 'piste', 'pistes')}</Text>
    </Pressable>
  );
}

export function PlaylistsTab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const smart = useSmartLists();
  const playlists = useUserStore((s) => s.playlists);
  const card = Math.round((width - 18 * 2 - 16) / 2.35);
  const gridCard = Math.floor((width - 18 * 2 - 16) / 2);

  const playlistMenu = (p: Playlist) => {
    const tracks = tracksFromIds(p.trackIds);
    useUI.getState().showSheet({
      title: p.name,
      subtitle: plural(p.trackIds.length, 'piste', 'pistes'),
      actions: collectionActions(tracks, [
        {
          label: 'Renommer',
          icon: 'edit',
          onPress: () =>
            useUI.getState().showPrompt({
              title: 'Renommer la liste',
              initial: p.name,
              confirmLabel: 'Renommer',
              onSubmit: (name) => useUserStore.getState().renamePlaylist(p.id, name),
            }),
        },
        {
          label: 'Supprimer',
          icon: 'trash',
          destructive: true,
          onPress: () =>
            useUI.getState().showConfirm({
              title: `Supprimer « ${p.name} » ?`,
              message: 'Les fichiers audio ne seront pas supprimés.',
              confirmLabel: 'Supprimer',
              destructive: true,
              onConfirm: () => useUserStore.getState().deletePlaylist(p.id),
            }),
        },
      ]),
    });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + MINI_SPACE, paddingTop: 22 }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 16 }}>
        {smart.map((s) => (
          <PlaylistCard
            key={s.id}
            name={s.name}
            count={s.trackIds.length}
            coverId={s.trackIds[0]}
            size={card}
            onPress={() => openCollection('smart', s.id)}
          />
        ))}
      </ScrollView>
      {playlists.length ? (
        <View style={styles.grid}>
          {playlists.map((p) => (
            <PlaylistCard
              key={p.id}
              name={p.name}
              count={p.trackIds.length}
              coverId={p.trackIds[0]}
              size={gridCard}
              onPress={() => openCollection('playlist', p.id)}
              onLongPress={() => playlistMenu(p)}
            />
          ))}
        </View>
      ) : (
        <View style={{ paddingTop: 70 }}>
          <EmptyState text={'Créez des listes de lecture. Elles\nseront affichées ici.'} action="Créer une liste" onAction={() => createPlaylistFlow()} />
        </View>
      )}
      {playlists.length ? (
        <Pressable onPress={() => createPlaylistFlow()} style={[styles.newPlaylist, { borderColor: t.divider }]}>
          <Icon name="plus" size={22} color={t.accent} strokeWidth={2} />
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>Nouvelle liste de lecture</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export function AlbumsTab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albums = useLibrary((s) => s.albums);
  const size = Math.floor((width - 18 * 2 - 16) / 2);
  const onMore = useCallback((a: Album) => {
    useUI.getState().showSheet({ title: a.name, subtitle: a.artist, actions: collectionActions(tracksFromIds(a.trackIds)) });
  }, []);
  return (
    <FlashList
      data={albums}
      numColumns={2}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ paddingTop: 18, paddingBottom: insets.bottom + MINI_SPACE, paddingHorizontal: 10 }}
      ListEmptyComponent={<EmptyState text="Aucun album" />}
      renderItem={({ item }) => (
        <Pressable onPress={() => openCollection('album', item.id)} onLongPress={() => onMore(item)} style={{ width: size, marginHorizontal: 8, marginBottom: 20 }}>
          <Artwork trackId={item.coverTrack.id} albumId={item.coverTrack.albumId} size={size} radius={24} quality={384} />
          <Text numberOfLines={1} style={[styles.albumTitle, { color: t.text }]}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={[styles.albumSub, { color: t.textSecondary }]}>
            {item.artist}
          </Text>
        </Pressable>
      )}
    />
  );
}

function NamedList<T>({
  items,
  getName,
  keyOf,
  render,
}: {
  items: T[];
  getName: (t: T) => string;
  keyOf: (t: T) => string;
  render: (t: T, rightInset: number) => React.ReactElement;
}) {
  const insets = useSafeAreaInsets();
  const ref = useRef<FlashListRef<T>>(null);
  const letters = useMemo(() => letterIndex(items, getName), [items, getName]);
  const showAlphabet = items.length > 25;
  return (
    <View style={{ flex: 1 }}>
      <FlashList
        ref={ref}
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item }) => render(item, showAlphabet ? 30 : 6)}
        ListHeaderComponent={<View style={{ height: 14 }} />}
        ListEmptyComponent={<EmptyState text="Rien à afficher" />}
        contentContainerStyle={{ paddingBottom: insets.bottom + MINI_SPACE }}
        showsVerticalScrollIndicator={!showAlphabet}
      />
      {showAlphabet ? (
        <AlphabetScroller
          available={new Set(letters.keys())}
          top={16}
          bottom={insets.bottom + MINI_SPACE}
          onSelect={(l) => {
            const i = letters.get(l);
            if (i !== undefined) ref.current?.scrollToIndex({ index: i, animated: false });
          }}
        />
      ) : null}
    </View>
  );
}

const artistName = (a: Artist) => a.name;
const folderNameOf = (f: Folder) => f.name;

export function ArtistsTab() {
  const artists = useLibrary((s) => s.artists);
  return (
    <NamedList
      items={artists}
      getName={artistName}
      keyOf={(a) => a.id}
      render={(a, inset) => (
        <CollectionRow
          title={a.name}
          subtitle={`${plural(a.albumCount, 'album', 'albums')} · ${plural(a.trackIds.length, 'piste', 'pistes')}`}
          coverTrackId={a.coverTrack.id}
          coverAlbumId={a.coverTrack.albumId}
          icon="person"
          round
          rightInset={inset}
          onPress={() => openCollection('artist', a.id)}
          onMore={() =>
            useUI.getState().showSheet({ title: a.name, actions: collectionActions(tracksFromIds(a.trackIds)) })
          }
        />
      )}
    />
  );
}

export function FoldersTab() {
  const folders = useLibrary((s) => s.folders);
  const sorted = useMemo(() => sortByName(folders, folderNameOf), [folders]);
  return (
    <NamedList
      items={sorted}
      getName={folderNameOf}
      keyOf={(f) => f.path}
      render={(f, inset) => (
        <CollectionRow
          title={f.name}
          subtitle={f.display}
          coverTrackId={f.coverTrack.id}
          coverAlbumId={f.coverTrack.albumId}
          icon="folderNote"
          rightInset={inset}
          onPress={() => openCollection('folder', f.path)}
          onMore={() =>
            useUI.getState().showSheet({
              title: f.name,
              subtitle: f.display,
              actions: collectionActions(tracksFromIds(f.trackIds), [
                { label: 'Masquer ce dossier', icon: 'eyeOff', onPress: () => hideFolder(f.path) },
              ]),
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 15.5,
    marginTop: 10,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 13.5,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 18,
    marginTop: 30,
  },
  newPlaylist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 18,
    marginTop: 26,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
  },
  albumTitle: {
    fontSize: 16,
    marginTop: 9,
  },
  albumSub: {
    fontSize: 14,
    marginTop: 1,
  },
});
