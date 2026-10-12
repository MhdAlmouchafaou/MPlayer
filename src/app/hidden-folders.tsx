import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/SettingItem';
import { Switch } from '../components/ui';
import { allFolders, useLibrary } from '../store/library';
import { useUserStore } from '../store/user';
import { useTheme } from '../theme';
import { folderName, plural } from '../utils';

export default function HiddenFoldersScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = useUserStore((s) => s.hiddenFolders);
  const setHidden = useUserStore((s) => s.setHiddenFolder);
  const byId = useLibrary((s) => s.byId);
  const [folders, setFolders] = useState<{ path: string; display: string; count: number }[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    allFolders().then(setFolders);
  }, [byId]);

  // Rescan once when leaving so the library reflects the new choices.
  useEffect(
    () => () => {
      if (dirty) useLibrary.getState().scan();
    },
    [dirty]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Masquer les dossiers" />
      <Text style={[styles.intro, { color: t.textSecondary }]}>
        Les pistes des dossiers masqués n'apparaissent plus dans la bibliothèque. Les fichiers ne sont pas supprimés.
      </Text>
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <FlatList
          data={folders}
          keyExtractor={(f) => f.path}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          renderItem={({ item, index }) => {
            const isHidden = hidden.includes(item.path);
            const toggle = () => {
              setHidden(item.path, !isHidden);
              setDirty(true);
            };
            return (
              <Pressable
                onPress={toggle}
                android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
                style={[styles.row, index < folders.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.divider }]}
              >
                <Icon name="folder" size={26} color={isHidden ? t.textTertiary : t.icon} />
                <View style={{ flex: 1, marginLeft: 16, marginRight: 12 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, color: isHidden ? t.textTertiary : t.text }}>
                    {folderName(item.path)}
                  </Text>
                  <Text numberOfLines={1} ellipsizeMode="middle" style={{ fontSize: 13.5, color: t.textSecondary, marginTop: 2 }}>
                    {item.display} · {plural(item.count, 'piste', 'pistes')}
                  </Text>
                </View>
                <Switch value={isHidden} onChange={toggle} />
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 14.5,
    lineHeight: 20,
    paddingHorizontal: 26,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});
