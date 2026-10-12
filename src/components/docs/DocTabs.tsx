import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Native } from '../../../modules/mplayer-core';
import { useDocs } from '../../store/docs';
import { moveToVault } from '../../lib/vaultActions';
import { useMedia } from '../../store/media';
import { toast, useUI } from '../../store/ui';
import { useTheme } from '../../theme';
import { displayFolder, formatSize, plural } from '../../utils';
import { EmptyState } from '../EmptyState';
import { Icon } from '../Icon';
import { BOTTOM_SPACE } from '../video/VideoTabs';

export type DocEntry = { uri: string; name: string; size?: number; folder?: string; modified?: number; page?: number; pages?: number };

const thumbCache = new Map<string, string | null>();

function useDocThumb(uri: string) {
  const [thumb, setThumb] = useState<string | null>(thumbCache.get(uri) ?? null);
  useEffect(() => {
    if (thumbCache.has(uri)) return setThumb(thumbCache.get(uri)!);
    let alive = true;
    Native?.pdfThumbnail(uri, 160)
      .then((t) => {
        thumbCache.set(uri, t);
        if (alive) setThumb(t);
      })
      .catch(() => thumbCache.set(uri, null));
    return () => {
      alive = false;
    };
  }, [uri]);
  return thumb;
}

export function openDoc(d: DocEntry) {
  router.push({ pathname: '/pdf', params: { uri: d.uri, name: d.name } });
}

export async function pickDocument() {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: false, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await Native?.persistUri(a.uri).catch(() => false);
    openDoc({ uri: a.uri, name: a.name, size: a.size ?? 0 });
  } catch {
    toast("Impossible d'ouvrir ce fichier");
  }
}

function docMenu(d: DocEntry) {
  const m = useMedia.getState();
  const fav = m.docFavorites.includes(d.uri);
  useUI.getState().showSheet({
    title: d.name,
    subtitle: d.size ? formatSize(d.size) : undefined,
    actions: [
      { label: 'Ouvrir', icon: 'doc', onPress: () => openDoc(d) },
      {
        label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris',
        icon: fav ? 'heartFilled' : 'heart',
        onPress: () => toast(useMedia.getState().toggleDocFavorite(d.uri) ? 'Ajouté aux favoris' : 'Retiré des favoris'),
      },
      { label: 'Partager', icon: 'share', onPress: () => Native?.shareFile(d.uri, 'application/pdf', d.name) },
      { label: 'Déplacer dans le dossier privé', icon: 'lock', onPress: () => moveToVault([d.uri], `« ${d.name} »`) },
      ...(m.docRecents.some((r) => r.uri === d.uri)
        ? [{ label: 'Retirer des récents', icon: 'history', onPress: () => useMedia.getState().removeDocRecent(d.uri) }]
        : []),
    ],
  });
}

const DocRow = memo(function DocRow({ d }: { d: DocEntry }) {
  const t = useTheme();
  const thumb = useDocThumb(d.uri);
  const recent = useMedia((s) => s.docRecents.find((r) => r.uri === d.uri));
  const fav = useMedia((s) => s.docFavorites.includes(d.uri));
  const ratio = recent && recent.pages > 1 ? (recent.page + 1) / recent.pages : 0;
  return (
    <Pressable
      onPress={() => openDoc(d)}
      onLongPress={() => docMenu(d)}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
      style={styles.row}
    >
      <View style={[styles.thumb, { backgroundColor: t.dark ? '#2A2C33' : '#FFFFFF', borderColor: t.divider }]}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={120} />
        ) : (
          <Icon name="doc" size={26} color={t.textTertiary} />
        )}
        <View style={styles.pdfTag}>
          <Text style={styles.pdfTagText}>PDF</Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text numberOfLines={2} style={{ fontSize: 15.5, color: t.text, lineHeight: 20 }}>
          {d.name.replace(/\.pdf$/i, '')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, color: t.textSecondary, flexShrink: 1 }}>
            {[d.size ? formatSize(d.size) : null, recent && recent.pages ? `p. ${recent.page + 1}/${recent.pages}` : null, d.folder ? displayFolder(d.folder).split('/').pop() : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {fav ? <Icon name="heartFilled" size={13} color={t.accent} /> : null}
        </View>
        {ratio > 0 ? (
          <View style={[styles.track, { backgroundColor: t.chip }]}>
            <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: t.accent }]} />
          </View>
        ) : null}
      </View>
      <Pressable onPress={() => docMenu(d)} hitSlop={8} style={styles.more}>
        <Icon name="more" size={20} color={t.textSecondary} />
      </Pressable>
    </Pressable>
  );
});

function OpenFileBar() {
  const t = useTheme();
  return (
    <Pressable onPress={pickDocument} style={[styles.openBar, { backgroundColor: t.accentTrack }]} android_ripple={{ color: 'rgba(0,0,0,0.06)' }}>
      <Icon name="fileOpen" size={22} color={t.accent} />
      <Text style={{ color: t.accent, fontSize: 15.5, fontWeight: '600', marginLeft: 10 }}>Ouvrir un fichier PDF</Text>
    </Pressable>
  );
}

function DocList({ data, empty, header }: { data: DocEntry[]; empty: React.ReactElement; header?: React.ReactElement | null }) {
  const insets = useSafeAreaInsets();
  return (
    <FlashList
      data={data}
      keyExtractor={(d) => d.uri}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_SPACE }}
      renderItem={({ item }) => <DocRow d={item} />}
    />
  );
}

function AccessCard() {
  const t = useTheme();
  const allFiles = useDocs((s) => s.allFiles);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        useDocs
          .getState()
          .refreshAccess()
          .then((ok) => {
            if (ok) useDocs.getState().scan();
          });
      }
    });
    return () => sub.remove();
  }, []);
  if (allFiles) return null;
  return (
    <View style={[styles.access, { backgroundColor: t.dark ? '#1E2433' : '#E8F0FD' }]}>
      <Icon name="spark" size={24} color={t.accent} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '600' }}>Trouver tous vos PDF</Text>
        <Text style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 3, lineHeight: 19 }}>
          Android réserve la liste des documents aux applications autorisées à « gérer tous les fichiers ».
        </Text>
        <Pressable onPress={() => Native?.requestAllFilesAccess()} style={[styles.accessBtn, { backgroundColor: t.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14.5 }}>Autoriser</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AllDocsTab() {
  const docs = useDocs((s) => s.docs);
  const loaded = useDocs((s) => s.loaded);
  const data = useMemo(() => docs.map((d) => ({ uri: d.uri, name: d.name, size: d.size, folder: d.folder, modified: d.modified })), [docs]);
  return (
    <DocList
      data={data}
      header={
        <View>
          <AccessCard />
          <OpenFileBar />
          {data.length ? <Text style={styles.count}>{plural(data.length, 'document', 'documents')}</Text> : null}
        </View>
      }
      empty={loaded ? <EmptyState text={'Aucun PDF trouvé.\nOuvrez-en un avec le bouton ci-dessus.'} /> : <View />}
    />
  );
}

export function RecentDocsTab() {
  const recents = useMedia((s) => s.docRecents);
  return (
    <DocList
      data={recents}
      header={<OpenFileBar />}
      empty={<EmptyState text={'Les documents que vous ouvrez\napparaîtront ici.'} />}
    />
  );
}

export function FavoriteDocsTab() {
  const favs = useMedia((s) => s.docFavorites);
  const recents = useMedia((s) => s.docRecents);
  const docs = useDocs((s) => s.docs);
  const data = useMemo(
    () =>
      favs.map(
        (uri) =>
          recents.find((r) => r.uri === uri) ??
          docs.find((d) => d.uri === uri) ?? { uri, name: decodeURIComponent(uri.split('/').pop() ?? 'Document') }
      ),
    [favs, recents, docs]
  );
  return <DocList data={data} empty={<EmptyState text={'Ajoutez des documents à vos favoris\ndepuis leur menu.'} />} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 4, paddingVertical: 10, minHeight: 88 },
  thumb: { width: 54, height: 70, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  pdfTag: { position: 'absolute', left: 0, bottom: 6, backgroundColor: '#E5483F', paddingHorizontal: 5, borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  pdfTagText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  track: { height: 3.5, borderRadius: 2, marginTop: 8, overflow: 'hidden', width: '70%' },
  fill: { height: '100%' },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  openBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26, marginHorizontal: 16, marginTop: 16, marginBottom: 6 },
  count: { fontSize: 14, color: '#8A8E97', marginLeft: 20, marginTop: 14, marginBottom: 4 },
  access: { flexDirection: 'row', margin: 16, marginBottom: 2, padding: 16, borderRadius: 22 },
  accessBtn: { alignSelf: 'flex-start', marginTop: 12, height: 38, paddingHorizontal: 18, borderRadius: 19, justifyContent: 'center' },
});
