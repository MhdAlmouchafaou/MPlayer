import { router } from 'expo-router';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { CollectionRow, TrackRow } from '../components/rows';
import { MINI_SPACE } from '../components/TrackList';
import { IconButton } from '../components/ui';
import { openCollection, openTrackMenu } from '../lib/actions';
import { useLibrary, type Album, type Artist, type Folder, type Track } from '../store/library';
import { usePlayer } from '../store/player';
import { useTheme } from '../theme';
import type { NativeDoc } from '../../modules/mplayer-core';
import { openDoc } from '../components/docs/DocTabs';
import { VideoRow } from '../components/video/VideoItems';
import { openVideoMenu, playVideos } from '../lib/videoActions';
import { useDocs } from '../store/docs';
import { useVideos, type Video } from '../store/videos';
import { plural } from '../utils';

const norm = (s: string) => {
  let v = (s || '').toLowerCase();
  try {
    v = v.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // keep as is
  }
  return v;
};

type Row =
  | { kind: 'video'; video: Video; index: number }
  | { kind: 'doc'; doc: NativeDoc }
  | { kind: 'track'; track: Track; index: number }
  | { kind: 'album'; album: Album }
  | { kind: 'artist'; artist: Artist }
  | { kind: 'folder'; folder: Folder };

export default function SearchScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const tracks = useLibrary((s) => s.tracks);
  const albums = useLibrary((s) => s.albums);
  const artists = useLibrary((s) => s.artists);
  const folders = useLibrary((s) => s.folders);
  const currentId = usePlayer((s) => s.queue[s.index]);
  const videos = useVideos((s) => s.videos);
  const docs = useDocs((s) => s.docs);
  const playTracks = usePlayer((s) => s.playTracks);

  const results = useMemo(() => {
    const term = norm(q.trim());
    if (!term) return { sections: [] as { title: string; data: Row[] }[], trackList: [] as Track[], videoList: [] as Video[] };
    const words = term.split(/\s+/);
    const match = (...fields: string[]) => {
      const hay = norm(fields.join(' '));
      return words.every((w) => hay.includes(w));
    };
    const trackList = tracks.filter((x) => match(x.title, x.artist, x.album, x.fileName)).slice(0, 200);
    const videoList = videos.filter((v) => match(v.title, v.fileName, v.folder)).slice(0, 100);
    const docList = docs.filter((d) => match(d.name, d.folder)).slice(0, 60);
    const albumList = albums.filter((a) => match(a.name, a.artist)).slice(0, 20);
    const artistList = artists.filter((a) => match(a.name)).slice(0, 20);
    const folderList = folders.filter((f) => match(f.name, f.display)).slice(0, 20);
    const sections: { title: string; data: Row[] }[] = [];
    if (videoList.length)
      sections.push({ title: `Vidéos (${videoList.length})`, data: videoList.map((video, index) => ({ kind: 'video', video, index })) });
    if (trackList.length)
      sections.push({ title: `Pistes (${trackList.length})`, data: trackList.map((track, index) => ({ kind: 'track', track, index })) });
    if (artistList.length) sections.push({ title: 'Artistes', data: artistList.map((artist) => ({ kind: 'artist', artist })) });
    if (albumList.length) sections.push({ title: 'Albums', data: albumList.map((album) => ({ kind: 'album', album })) });
    if (folderList.length) sections.push({ title: 'Dossiers', data: folderList.map((folder) => ({ kind: 'folder', folder })) });
    if (docList.length) sections.push({ title: `Documents (${docList.length})`, data: docList.map((doc) => ({ kind: 'doc', doc })) });
    return { sections, trackList, videoList };
  }, [q, tracks, albums, artists, folders, videos, docs]);

  return (
    <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton name="chevronLeft" size={26} color={t.icon} label="Retour" onPress={() => router.back()} />
        <View style={[styles.field, { backgroundColor: t.chip }]}>
          <Icon name="search" size={20} color={t.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Rechercher"
            placeholderTextColor={t.textTertiary}
            returnKeyType="search"
            style={[styles.input, { color: t.text }]}
          />
          {query ? <IconButton name="close" size={18} hitSize={34} color={t.textSecondary} label="Effacer" onPress={() => setQuery('')} /> : null}
        </View>
      </View>
      <SectionList
        sections={results.sections}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + MINI_SPACE }}
        keyExtractor={(row) =>
          row.kind === 'video' ? `v${row.video.key}` : row.kind === 'doc' ? `d${row.doc.uri}` : row.kind === 'track' ? `t${row.track.id}` : row.kind === 'album' ? `a${row.album.id}` : row.kind === 'artist' ? `r${row.artist.id}` : `f${row.folder.path}`
        }
        renderSectionHeader={({ section }) => <Text style={[styles.section, { color: t.tabInactive }]}>{section.title}</Text>}
        renderItem={({ item }) => {
          switch (item.kind) {
            case 'video':
              return <VideoRow video={item.video} index={item.index} onPress={(i) => playVideos(results.videoList, i)} onMore={(v) => openVideoMenu(v, results.videoList)} />;
            case 'doc':
              return (
                <CollectionRow
                  title={item.doc.name.replace(/\.pdf$/i, '')}
                  subtitle={item.doc.folder}
                  icon="doc"
                  onPress={() => openDoc({ uri: item.doc.uri, name: item.doc.name, size: item.doc.size })}
                />
              );
            case 'track':
              return (
                <TrackRow
                  track={item.track}
                  index={item.index}
                  active={item.track.id === currentId}
                  onPress={(i) => playTracks(results.trackList, i)}
                  onMore={(tr) => openTrackMenu(tr)}
                />
              );
            case 'album':
              return (
                <CollectionRow
                  title={item.album.name}
                  subtitle={item.album.artist}
                  coverTrackId={item.album.coverTrack.id}
                  coverAlbumId={item.album.coverTrack.albumId}
                  icon="disc"
                  onPress={() => openCollection('album', item.album.id)}
                />
              );
            case 'artist':
              return (
                <CollectionRow
                  title={item.artist.name}
                  subtitle={plural(item.artist.trackIds.length, 'piste', 'pistes')}
                  coverTrackId={item.artist.coverTrack.id}
                  icon="person"
                  round
                  onPress={() => openCollection('artist', item.artist.id)}
                />
              );
            case 'folder':
              return (
                <CollectionRow
                  title={item.folder.name}
                  subtitle={item.folder.display}
                  coverTrackId={item.folder.coverTrack.id}
                  icon="folderNote"
                  onPress={() => openCollection('folder', item.folder.path)}
                />
              );
          }
        }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.textSecondary }]}>
            {q.trim() ? 'Aucun résultat' : 'Vidéos, musique, artistes, albums, dossiers ou PDF'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 14,
  },
  field: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 17,
    marginLeft: 10,
    paddingVertical: 0,
  },
  section: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 20,
    marginTop: 18,
    marginBottom: 4,
  },
  empty: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 16,
  },
});
