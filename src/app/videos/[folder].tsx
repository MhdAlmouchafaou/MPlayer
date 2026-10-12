import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../components/ui';
import { VideoList } from '../../components/video/VideoTabs';
import { useMedia } from '../../store/media';
import { toast, useUI } from '../../store/ui';
import { useVideos } from '../../store/videos';
import { useTheme } from '../../theme';
import { displayFolder, folderName, formatSize, plural } from '../../utils';

export default function VideoFolderScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { folder } = useLocalSearchParams<{ folder: string }>();
  const all = useVideos((s) => s.videos);
  const videos = useMemo(() => all.filter((v) => v.folder === folder), [all, folder]);
  const size = videos.reduce((a, v) => a + v.size, 0);
  return (
    <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton name="chevronLeft" size={26} color={t.icon} label="Retour" onPress={() => router.back()} />
        <View style={{ flex: 1, marginHorizontal: 6 }}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
            {folderName(folder ?? '')}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: t.textSecondary, fontSize: 13 }}>
            {plural(videos.length, 'vidéo', 'vidéos')} · {formatSize(size)} · {displayFolder(folder ?? '')}
          </Text>
        </View>
        <IconButton
          name="eyeOff"
          size={23}
          color={t.icon}
          label="Masquer ce dossier"
          onPress={() =>
            useUI.getState().showConfirm({
              title: 'Masquer ce dossier ?',
              message: 'Ses vidéos n’apparaîtront plus dans la bibliothèque. Vous pourrez le réafficher dans les paramètres.',
              confirmLabel: 'Masquer',
              onConfirm: () => {
                const v = useMedia.getState().video;
                useMedia.getState().updateVideo({ hiddenFolders: [...v.hiddenFolders, folder] });
                useVideos.getState().scan();
                toast('Dossier masqué');
                router.back();
              },
            })
          }
        />
      </View>
      <VideoList videos={videos} listKey="folder" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: 19, fontWeight: '600' },
});
