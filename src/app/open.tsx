import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Native } from '../../modules/mplayer-core';
import { playUri } from '../lib/videoActions';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { toast } from '../store/ui';

/** Entry point for files opened from other apps ("Ouvrir avec MPlayer"). */
export default function OpenScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  useEffect(() => {
    if (!uri) {
      router.replace('/');
      return;
    }
    (async () => {
      const info = Native ? await Native.describeUri(uri).catch(() => null) : null;
      const mime = info?.mimeType ?? '';
      const name = info?.name ?? uri.split('/').pop() ?? 'Fichier';
      const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name);
      const isAudio = mime.startsWith('audio/') || /\.(mp3|m4a|aac|flac|wav|ogg|opus|wma|amr)$/i.test(name);
      router.replace('/');
      setTimeout(() => {
        if (isPdf) router.push({ pathname: '/pdf', params: { uri, name } });
        else if (isAudio) {
          const known = useLibrary.getState().tracks.find((t) => t.uri === uri);
          const track = known ?? {
            id: `ext:${uri}`,
            uri,
            title: name.replace(/\.[^.]+$/, ''),
            artist: '',
            album: '',
            albumId: '0',
            artistId: '0',
            duration: 0,
            path: '',
            folder: '',
            fileName: name,
            dateAdded: Date.now() / 1000,
            size: info?.size ?? 0,
            mimeType: mime,
            trackNumber: 0,
            year: 0,
            genre: '',
          };
          if (!known) useLibrary.setState((s) => ({ byId: { ...s.byId, [track.id]: track } }));
          usePlayer.getState().playTracks([track], 0);
          toast(`Lecture : ${track.title}`);
        } else playUri(uri, name);
      }, 80);
    })();
  }, [uri]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator color="#fff" />
    </View>
  );
}
