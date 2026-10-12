import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openTrackMenu } from '../../lib/actions';
import { useLibrary, type Track } from '../../store/library';
import { usePlayer } from '../../store/player';
import { useUI } from '../../store/ui';
import { useTheme } from '../../theme';
import { artistOf, formatTime, formatTotal } from '../../utils';
import { Artwork } from '../Artwork';
import { Icon } from '../Icon';
import { IconButton } from '../ui';

const ROW = 66;

function NowBadge() {
  const isPlaying = usePlayer((s) => s.isPlaying);
  return (
    <View style={styles.nowBadge}>
      <Icon name={isPlaying ? 'equalizer' : 'pause'} size={18} color="#fff" strokeWidth={2.2} />
    </View>
  );
}

const QueueRow = memo(function QueueRow({
  track,
  index,
  current,
  past,
  onPress,
  onMore,
}: {
  track: Track;
  index: number;
  current: boolean;
  past: boolean;
  onPress: (i: number) => void;
  onMore: (t: Track, i: number) => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onPress(index)}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
      style={[styles.row, current && { backgroundColor: t.dark ? 'rgba(126,166,245,0.13)' : 'rgba(46,102,201,0.08)' }]}
    >
      <View style={{ opacity: past ? 0.5 : 1 }}>
        <Artwork trackId={track.id} albumId={track.albumId} size={46} radius={13} />
        {current ? <NowBadge /> : null}
      </View>
      <View style={{ flex: 1, marginLeft: 14, opacity: past ? 0.5 : 1 }}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: current ? t.accent : t.text }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={[styles.rowSub, { color: t.textSecondary }]}>
          {artistOf(track)} · {formatTime(track.duration)}
        </Text>
      </View>
      <Pressable
        onPress={() => onMore(track, index)}
        hitSlop={6}
        android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: true, radius: 20 }}
        style={styles.more}
        accessibilityLabel="Options"
      >
        <Icon name="more" size={20} color={t.textSecondary} />
      </Pressable>
    </Pressable>
  );
});

/**
 * Queue shown in its own window (Modal): no gesture of the player underneath can steal
 * the scroll, so the list behaves like any normal list in both directions.
 */
export function QueuePanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const byId = useLibrary((s) => s.byId);
  const list = useRef<FlatList<string>>(null);
  const [currentVisible, setCurrentVisible] = useState(true);
  const indexRef = useRef(index);
  indexRef.current = index;

  const remaining = useMemo(() => {
    let ms = 0;
    for (let i = index; i < queue.length; i++) ms += byId[queue[i]]?.duration ?? 0;
    return ms;
  }, [queue, index, byId]);

  const scrollToCurrent = useCallback((animated: boolean) => {
    const i = indexRef.current;
    list.current?.scrollToOffset({ offset: Math.max(0, (i - 1) * ROW), animated });
  }, []);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setCurrentVisible(viewableItems.some((v) => v.index === indexRef.current));
  }).current;

  const onPress = useCallback((i: number) => usePlayer.getState().skipTo(i), []);
  const onMore = useCallback((track: Track, i: number) => {
    const p = usePlayer.getState();
    useUI.getState().showSheet({
      title: track.title,
      subtitle: artistOf(track),
      track,
      actions: [
        ...(i !== p.index
          ? [
              {
                label: 'Lire ensuite',
                icon: 'playNext',
                onPress: () => {
                  const s = usePlayer.getState();
                  s.moveInQueue(i, i < s.index ? s.index : s.index + 1);
                },
              },
            ]
          : []),
        ...(i > 0 ? [{ label: 'Monter', icon: 'chevronUp', onPress: () => usePlayer.getState().moveInQueue(i, i - 1) }] : []),
        ...(i < p.queue.length - 1
          ? [{ label: 'Descendre', icon: 'chevronDown', onPress: () => usePlayer.getState().moveInQueue(i, i + 1) }]
          : []),
        { label: "Retirer de la file d'attente", icon: 'close', onPress: () => usePlayer.getState().removeFromQueue(i) },
        { label: "Plus d'options", icon: 'more', onPress: () => setTimeout(() => openTrackMenu(track, { queueIndex: i }), 220) },
      ],
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index: i }: { item: string; index: number }) => {
      const track = byId[item];
      if (!track) return <View style={{ height: ROW }} />;
      return <QueueRow track={track} index={i} current={i === index} past={i < index} onPress={onPress} onMore={onMore} />;
    },
    [byId, index, onPress, onMore]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => scrollToCurrent(false)}
    >
      <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <IconButton name="chevronDown" size={28} color={t.icon} strokeWidth={1.6} label="Fermer" onPress={onClose} />
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={[styles.title, { color: t.text }]}>File d'attente</Text>
            <Text style={{ color: t.textSecondary, fontSize: 13.5 }}>
              {queue.length ? `${index + 1} sur ${queue.length} · ${formatTotal(remaining)} restantes` : 'Vide'}
            </Text>
          </View>
          {queue.length ? (
            <Pressable
              onPress={() =>
                useUI.getState().showConfirm({
                  title: "Vider la file d'attente ?",
                  confirmLabel: 'Vider',
                  destructive: true,
                  onConfirm: () => {
                    onClose();
                    usePlayer.getState().clearQueue();
                    useUI.getState().setPlayerOpen(false);
                  },
                })
              }
              style={styles.clear}
            >
              <Text style={{ color: t.accent, fontSize: 15, fontWeight: '600' }}>Vider</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        <FlatList
          ref={list}
          data={queue}
          keyExtractor={(id, i) => `${id}-${i}`}
          renderItem={renderItem}
          extraData={index}
          getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={30}
          windowSize={9}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          overScrollMode="always"
          showsVerticalScrollIndicator
        />

        {!currentVisible && queue.length ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(160)}
            style={[styles.jumpWrap, { bottom: insets.bottom + 22 }]}
          >
            <Pressable
              onPress={() => scrollToCurrent(true)}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              style={[styles.jump, { backgroundColor: t.accent }]}
            >
              <Icon name="note" size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.jumpText}>Morceau en cours</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  clear: {
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
  },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 6,
  },
  rowTitle: {
    fontSize: 16.5,
  },
  rowSub: {
    fontSize: 13.5,
    marginTop: 2,
  },
  more: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpWrap: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 6,
  },
  jump: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 20,
  },
  jumpText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
