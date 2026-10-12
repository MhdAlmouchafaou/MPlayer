import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openVideoMenu, playVideos } from '../../lib/videoActions';
import { useMedia } from '../../store/media';
import { useVideo } from '../../store/video';
import { useVideos, type Video, type VideoFolder } from '../../store/videos';
import { useTheme } from '../../theme';
import { formatSize, plural, sortByName } from '../../utils';
import { EmptyState } from '../EmptyState';
import { Icon } from '../Icon';
import { PopupMenu } from '../PopupMenu';
import { RoundButton } from '../ui';
import { VIDEO_ROW, VideoCard, VideoRow, VideoThumb } from './VideoItems';

export const BOTTOM_SPACE = 170;

type SortKey = 'date' | 'name' | 'size' | 'duration';
const SORT_LABELS: Record<SortKey, string> = { date: "Date d'ajout", name: 'Nom', size: 'Taille', duration: 'Durée' };

function sortVideos(list: Video[], key: SortKey, desc: boolean) {
  let out: Video[];
  if (key === 'name') out = sortByName(list, (v) => v.title);
  else if (key === 'size') out = [...list].sort((a, b) => b.size - a.size);
  else if (key === 'duration') out = [...list].sort((a, b) => b.duration - a.duration);
  else out = [...list].sort((a, b) => b.dateAdded - a.dateAdded);
  return desc ? out.reverse() : out;
}

function ContinueRow() {
  const t = useTheme();
  const progress = useMedia((s) => s.progress);
  const byKey = useVideos((s) => s.byKey);
  const items = useMemo(
    () =>
      Object.entries(progress)
        .filter(([k, p]) => p.position > 0 && byKey[k])
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, 12)
        .map(([k]) => byKey[k]),
    [progress, byKey]
  );
  if (!items.length) return null;
  return (
    <View style={{ paddingTop: 16 }}>
      <Text style={[styles.section, { color: t.text }]}>Reprendre la lecture</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {items.map((v, i) => (
          <Pressable key={v.key} onPress={() => playVideos(items, i)} onLongPress={() => openVideoMenu(v, items)} style={{ width: 210 }}>
            <VideoThumb video={v} width={210} height={118} radius={18} />
            <View style={styles.playBadge}>
              <Icon name="play" size={16} color="#fff" />
            </View>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 14.5, marginTop: 8 }}>
              {v.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ListHeader({
  count,
  sort,
  desc,
  onSort,
  grid,
  onGrid,
  onShuffle,
  onPlay,
  extra,
}: {
  count: number;
  sort: SortKey;
  desc: boolean;
  onSort: (x: number, y: number) => void;
  grid: boolean;
  onGrid: () => void;
  onShuffle: () => void;
  onPlay: () => void;
  extra?: React.ReactNode;
}) {
  const t = useTheme();
  const ref = useRef<View>(null);
  return (
    <View>
      {extra}
      <View style={styles.sortRow}>
        <Pressable
          ref={ref}
          onPress={() => ref.current?.measureInWindow((x, y, _w, h) => onSort(x, y + h - 4))}
          style={styles.sortButton}
          hitSlop={8}
        >
          <Icon name={desc ? 'sortAsc' : 'sort'} size={26} color={t.textSecondary} strokeWidth={1.6} />
          <Text style={[styles.sortLabel, { color: t.textSecondary }]}>
            {SORT_LABELS[sort]} · {count}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onGrid} hitSlop={8} style={styles.gridToggle} accessibilityLabel="Affichage">
          <Icon name={grid ? 'list' : 'grid'} size={22} color={t.textSecondary} />
        </Pressable>
        <RoundButton name="shuffle" label="Aléatoire" onPress={onShuffle} />
        <View style={{ width: 10 }} />
        <RoundButton name="play" label="Tout lire" onPress={onPlay} />
        <View style={{ width: 14 }} />
      </View>
    </View>
  );
}

/** List or grid of videos with sorting, shared by the library tabs and folder screens. */
export function VideoList({
  videos,
  listKey,
  showContinue,
  emptyText,
}: {
  videos: Video[];
  listKey: string;
  showContinue?: boolean;
  emptyText?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const grid = useMedia((s) => s.video.grid);
  const updateVideo = useMedia((s) => s.updateVideo);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: listKey === 'folder' ? 'name' : 'date', desc: false });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const currentKey = useVideo((s) => (s.active ? s.items[s.index]?.key : undefined));
  const sorted = useMemo(() => sortVideos(videos, sort.key, sort.desc), [videos, sort]);
  const cols = grid ? (width > 700 ? 3 : 2) : 1;
  const cardW = Math.floor((width - 16 * 2 - 12 * (cols - 1)) / cols);

  const onPress = useCallback((i: number) => playVideos(sorted, i), [sorted]);
  const onMore = useCallback((v: Video) => openVideoMenu(v, sorted), [sorted]);

  const header = videos.length ? (
    <ListHeader
      count={videos.length}
      sort={sort.key}
      desc={sort.desc}
      onSort={(x, y) => setMenu({ x, y })}
      grid={grid}
      onGrid={() => updateVideo({ grid: !grid })}
      onShuffle={() => {
        const shuffled = [...sorted].sort(() => Math.random() - 0.5);
        playVideos(shuffled, 0);
      }}
      onPlay={() => playVideos(sorted, 0)}
      extra={showContinue ? <ContinueRow /> : null}
    />
  ) : showContinue ? (
    <ContinueRow />
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        key={`cols-${cols}`}
        data={sorted}
        numColumns={cols}
        keyExtractor={(v) => v.key}
        ListHeaderComponent={header}
        columnWrapperStyle={cols > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_SPACE, gap: cols > 1 ? 18 : 0 }}
        getItemLayout={cols === 1 ? undefined : undefined}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={<EmptyState text={emptyText ?? 'Aucune vidéo trouvée sur cet appareil.'} />}
        renderItem={({ item, index }) =>
          cols > 1 ? (
            <VideoCard video={item} index={index} width={cardW} onPress={onPress} onMore={onMore} />
          ) : (
            <VideoRow video={item} index={index} onPress={onPress} onMore={onMore} active={item.key === currentKey} />
          )
        }
      />
      <PopupMenu
        visible={!!menu}
        anchor={menu ? { ...menu, align: 'left' } : null}
        title="Trier par"
        onClose={() => setMenu(null)}
        items={[
          ...(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
            label: SORT_LABELS[k],
            checked: sort.key === k,
            onPress: () => setSort({ key: k, desc: sort.key === k ? !sort.desc : false }),
          })),
          { label: sort.desc ? 'Ordre normal' : 'Ordre inversé', onPress: () => setSort({ ...sort, desc: !sort.desc }) },
        ]}
      />
    </View>
  );
}

export function AllVideosTab() {
  const videos = useVideos((s) => s.videos);
  return <VideoList videos={videos} listKey="all" showContinue />;
}

const FolderRow = React.memo(function FolderRow({ folder, onPress }: { folder: VideoFolder; onPress: () => void }) {
  const t = useTheme();
  const cover = folder.videos.reduce((a, b) => (b.dateAdded > a.dateAdded ? b : a), folder.videos[0]);
  return (
    <Pressable onPress={onPress} android_ripple={{ color: 'rgba(0,0,0,0.05)' }} style={styles.folderRow}>
      <View>
        <View style={[styles.folderStack, { backgroundColor: t.dark ? '#2A2C33' : '#E3E6EC' }]} />
        <VideoThumb video={cover} width={112} height={68} radius={14} showDuration={false} />
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text numberOfLines={1} style={{ fontSize: 17, color: t.text }}>
          {folder.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 13.5, color: t.textSecondary, marginTop: 3 }}>
          {plural(folder.videos.length, 'vidéo', 'vidéos')} · {formatSize(folder.size)}
        </Text>
        <Text numberOfLines={1} ellipsizeMode="middle" style={{ fontSize: 12.5, color: t.textTertiary, marginTop: 2 }}>
          {folder.display}
        </Text>
      </View>
      <Icon name="chevronRight" size={20} color={t.textTertiary} />
      <View style={{ width: 14 }} />
    </Pressable>
  );
});

export function VideoFoldersTab() {
  const insets = useSafeAreaInsets();
  const folders = useVideos((s) => s.folders);
  return (
    <FlatList
      data={folders}
      keyExtractor={(f) => f.path}
      contentContainerStyle={{ paddingTop: 10, paddingBottom: insets.bottom + BOTTOM_SPACE }}
      ListEmptyComponent={<EmptyState text="Aucun dossier vidéo" />}
      renderItem={({ item }) => (
        <FolderRow folder={item} onPress={() => router.push({ pathname: '/videos/[folder]', params: { folder: item.path } })} />
      )}
    />
  );
}

export function HistoryTab() {
  const progress = useMedia((s) => s.progress);
  const byKey = useVideos((s) => s.byKey);
  const list = useMemo(
    () =>
      Object.entries(progress)
        .filter(([k]) => byKey[k])
        .sort((a, b) => b[1].at - a[1].at)
        .map(([k]) => byKey[k]),
    [progress, byKey]
  );
  return <VideoList videos={list} listKey="history" emptyText={'Les vidéos que vous regardez\napparaîtront ici.'} />;
}

export function VideoFavoritesTab() {
  const favs = useMedia((s) => s.videoFavorites);
  const byKey = useVideos((s) => s.byKey);
  const list = useMemo(() => favs.map((k) => byKey[k]).filter(Boolean), [favs, byKey]);
  return <VideoList videos={list} listKey="favorites" emptyText={'Ajoutez des vidéos à vos favoris\ndepuis leur menu.'} />;
}

export { VIDEO_ROW };

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: '600', marginLeft: 18, marginBottom: 12 },
  playBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: { height: 64, flexDirection: 'row', alignItems: 'center' },
  sortButton: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, height: 44 },
  sortLabel: { fontSize: 16, marginLeft: 10 },
  gridToggle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, height: 96 },
  folderStack: { position: 'absolute', left: 6, right: 6, top: -5, height: 20, borderRadius: 10 },
});
