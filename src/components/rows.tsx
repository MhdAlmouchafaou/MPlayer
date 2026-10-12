import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Track } from '../store/library';
import { useTheme } from '../theme';
import { artistOf } from '../utils';
import { Artwork } from './Artwork';
import { Icon, type IconName } from './Icon';

export const ROW_HEIGHT = 64;
const ART = 44;

type TrackRowProps = {
  track: Track;
  index: number;
  active?: boolean;
  subtitle?: string;
  rightInset?: number;
  onPress: (index: number) => void;
  onMore?: (track: Track, index: number) => void;
  onLongPress?: (track: Track, index: number) => void;
  selected?: boolean;
  selecting?: boolean;
};

export const TrackRow = memo(function TrackRow({
  track,
  index,
  active,
  subtitle,
  rightInset = 0,
  onPress,
  onMore,
  onLongPress,
  selected,
  selecting,
}: TrackRowProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onPress(index)}
      onLongPress={onLongPress ? () => onLongPress(track, index) : undefined}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
      style={[styles.row, { paddingRight: rightInset }]}
    >
      {selecting ? (
        <View style={[styles.check, { borderColor: selected ? t.accent : t.textTertiary, backgroundColor: selected ? t.accent : 'transparent' }]}>
          {selected ? <Icon name="check" size={16} color="#fff" strokeWidth={2.4} /> : null}
        </View>
      ) : null}
      <Artwork trackId={track.id} albumId={track.albumId} size={ART} radius={13} />
      <View style={[styles.textBox, { borderBottomColor: t.divider }]}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: active ? t.accent : t.text }]}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: t.textSecondary }]}>
            {subtitle ?? artistOf(track)}
          </Text>
        </View>
        {onMore && !selecting ? (
          <Pressable
            onPress={() => onMore(track, index)}
            hitSlop={8}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true, radius: 20 }}
            style={styles.more}
            accessibilityLabel="Options"
          >
            <Icon name="more" size={20} color={t.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

type CollectionRowProps = {
  title: string;
  subtitle?: string;
  coverTrackId?: string;
  coverAlbumId?: string;
  icon?: IconName;
  round?: boolean;
  rightInset?: number;
  onPress: () => void;
  onMore?: () => void;
};

export const CollectionRow = memo(function CollectionRow({
  title,
  subtitle,
  coverTrackId,
  coverAlbumId,
  icon = 'note',
  round,
  rightInset = 0,
  onPress,
  onMore,
}: CollectionRowProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
      style={[styles.row, { paddingRight: rightInset }]}
    >
      <Artwork trackId={coverTrackId} albumId={coverAlbumId} size={ART} radius={round ? ART / 2 : 13} icon={icon} />
      <View style={[styles.textBox, { borderBottomColor: t.divider }]}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.subtitle, { color: t.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onMore ? (
          <Pressable onPress={onMore} hitSlop={8} style={styles.more} accessibilityLabel="Options">
            <Icon name="more" size={20} color={t.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 17,
  },
  textBox: {
    flex: 1,
    height: '100%',
    marginLeft: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  title: {
    fontSize: 16,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 13.5,
    marginTop: 2,
  },
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
