import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openTrackMenu } from '../lib/actions';
import { letterIndex, SORT_LABELS, sortTracks } from '../lib/sorting';
import type { Track } from '../store/library';
import { usePlayer } from '../store/player';
import { useUserStore, type SortKey } from '../store/user';
import { useTheme } from '../theme';
import { artistOf } from '../utils';
import { AlphabetScroller } from './AlphabetScroller';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { PopupMenu } from './PopupMenu';
import { ROW_HEIGHT, TrackRow } from './rows';
import { RoundButton } from './ui';

export const MINI_SPACE = 92;

type Props = {
  tracks: Track[];
  listKey: string;
  sortKeys?: SortKey[];
  defaultSort?: { key: SortKey; desc: boolean };
  sortable?: boolean;
  header?: React.ReactElement | null;
  playlistId?: string;
  emptyTitle?: string;
  emptyText?: string;
  subtitle?: (t: Track) => string;
  alphabet?: boolean;
};

export function TrackList({
  tracks,
  listKey,
  sortKeys = ['name', 'dateAdded', 'artist', 'album', 'duration'],
  defaultSort = { key: 'name', desc: false },
  sortable = true,
  header,
  playlistId,
  emptyTitle,
  emptyText,
  subtitle,
  alphabet = true,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sort = useUserStore((s) => s.sorts[listKey]) ?? defaultSort;
  const setSort = useUserStore((s) => s.setSort);
  const playCounts = useUserStore((s) => s.playCounts);
  const currentId = usePlayer((s) => s.queue[s.index]);
  const playTracks = usePlayer((s) => s.playTracks);
  const listRef = useRef<FlatList<Track>>(null);
  const sortRef = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const sorted = useMemo(
    () => (sortable ? sortTracks(tracks, sort.key, sort.desc, playCounts) : tracks),
    // playCounts only matters for the "count" sort
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, sortable, sort.key, sort.desc, sort.key === 'count' ? playCounts : null]
  );
  const showAlphabet = alphabet && sortable && sort.key === 'name' && sorted.length > 30;
  const letters = useMemo(() => (showAlphabet ? letterIndex(sorted, (x) => x.title) : new Map()), [showAlphabet, sorted]);

  const onPress = useCallback((index: number) => playTracks(sorted, index), [playTracks, sorted]);
  const onMore = useCallback(
    (track: Track, index: number) => openTrackMenu(track, playlistId ? { playlistId, playlistIndex: index } : {}),
    [playlistId]
  );

  const renderItem: ListRenderItem<Track> = useCallback(
    ({ item, index }) => (
      <TrackRow
        track={item}
        index={index}
        active={item.id === currentId}
        onPress={onPress}
        onMore={onMore}
        rightInset={showAlphabet ? 30 : 6}
        subtitle={subtitle ? subtitle(item) : artistOf(item)}
      />
    ),
    [currentId, onPress, onMore, showAlphabet, subtitle]
  );

  const SORT_ROW = 64;
  const listHeader = (
    <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      {header}
      {tracks.length ? (
        <View style={styles.sortRow}>
          {sortable ? (
            <Pressable
              ref={sortRef}
              onPress={() =>
                sortRef.current?.measureInWindow((x, y, _w, h) => setMenu({ x, y: y + h - 4 }))
              }
              style={styles.sortButton}
              hitSlop={8}
            >
              <Icon name={sort.desc ? 'sortAsc' : 'sort'} size={26} color={t.textSecondary} strokeWidth={1.6} />
              <Text style={[styles.sortLabel, { color: t.textSecondary }]}>{SORT_LABELS[sort.key]}</Text>
            </Pressable>
          ) : (
            <Text style={[styles.sortLabel, { color: t.textSecondary, marginLeft: 26 }]}>
              {tracks.length} {tracks.length > 1 ? 'pistes' : 'piste'}
            </Text>
          )}
          <View style={{ flex: 1 }} />
          <RoundButton name="shuffle" label="Lecture aléatoire" onPress={() => playTracks(sorted, 0, { shuffle: true })} />
          <View style={{ width: 12 }} />
          <RoundButton name="play" label="Tout lire" onPress={() => playTracks(sorted, 0, { shuffle: false })} />
          <View style={{ width: 14 }} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: headerHeight + ROW_HEIGHT * index, index })}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyState title={emptyTitle} text={emptyText ?? 'Aucune piste'} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + MINI_SPACE }}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
        showsVerticalScrollIndicator={!showAlphabet}
      />
      {showAlphabet ? (
        <AlphabetScroller
          available={new Set(letters.keys())}
          top={headerHeight > 0 ? Math.min(headerHeight, 140) : SORT_ROW}
          bottom={insets.bottom + MINI_SPACE}
          onSelect={(letter) => {
            const i = letters.get(letter);
            if (i !== undefined) listRef.current?.scrollToIndex({ index: i, animated: false });
          }}
        />
      ) : null}
      <PopupMenu
        visible={!!menu}
        anchor={menu ? { ...menu, align: 'left' } : null}
        onClose={() => setMenu(null)}
        title="Trier par"
        items={[
          ...sortKeys.map((key) => ({
            label: SORT_LABELS[key],
            checked: sort.key === key,
            onPress: () => setSort(listKey, key, sort.key === key ? !sort.desc : false),
          })),
          {
            label: sort.desc ? 'Ordre croissant' : 'Ordre décroissant',
            onPress: () => setSort(listKey, sort.key, !sort.desc),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sortRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 12,
    height: 44,
  },
  sortLabel: {
    fontSize: 17,
    marginLeft: 10,
  },
});
