import { Image } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoThumb } from '../../lib/thumbs';
import { useMedia } from '../../store/media';
import type { Video } from '../../store/videos';
import { useTheme } from '../../theme';
import { formatSize, formatTime } from '../../utils';
import { Icon } from '../Icon';

export function qualityLabel(w: number, h: number) {
  const p = Math.min(w, h);
  if (p >= 2000) return '4K';
  if (p >= 1400) return '1440p';
  if (p >= 1000) return '1080p';
  if (p >= 700) return '720p';
  if (p >= 460) return '480p';
  return p > 0 ? `${p}p` : '';
}

export const VideoThumb = memo(function VideoThumb({
  video,
  width,
  height,
  radius = 14,
  style,
  showDuration = true,
}: {
  video: Pick<Video, 'id' | 'uri' | 'duration' | 'key'>;
  width: number;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  showDuration?: boolean;
}) {
  const t = useTheme();
  const thumb = useVideoThumb(video.id ?? video.uri, 320);
  const progress = useMedia((s) => s.progress[video.key]);
  const ratio = progress && progress.duration > 0 && progress.position > 0 ? Math.min(1, progress.position / progress.duration) : 0;
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: t.dark ? '#24262C' : '#DCDFE5' }, style]}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={video.key} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name="film" size={Math.min(width, height) * 0.36} color={t.dark ? '#4A4D55' : '#FFFFFF'} strokeWidth={1.8} />
        </View>
      )}
      {showDuration && video.duration > 0 ? (
        <View style={styles.duration}>
          <Text style={styles.durationText}>{formatTime(video.duration)}</Text>
        </View>
      ) : null}
      {ratio > 0 ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: t.accent }]} />
        </View>
      ) : null}
    </View>
  );
});

export const VIDEO_ROW = 92;

export const VideoRow = memo(function VideoRow({
  video,
  index,
  onPress,
  onMore,
  active,
}: {
  video: Video;
  index: number;
  onPress: (i: number) => void;
  onMore: (v: Video) => void;
  active?: boolean;
}) {
  const t = useTheme();
  const fav = useMedia((s) => s.videoFavorites.includes(video.key));
  const q = qualityLabel(video.width, video.height);
  return (
    <Pressable
      onPress={() => onPress(index)}
      onLongPress={() => onMore(video)}
      android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
      style={styles.row}
    >
      <VideoThumb video={video} width={124} height={72} radius={14} />
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.title, { color: active ? t.accent : t.text }]}>
          {video.title}
        </Text>
        <View style={styles.metaRow}>
          {q ? (
            <View style={[styles.badge, { backgroundColor: t.chip }]}>
              <Text style={[styles.badgeText, { color: t.textSecondary }]}>{q}</Text>
            </View>
          ) : null}
          <Text numberOfLines={1} style={[styles.meta, { color: t.textSecondary }]}>
            {formatSize(video.size)}
          </Text>
          {fav ? <Icon name="heartFilled" size={13} color={t.accent} /> : null}
        </View>
      </View>
      <Pressable onPress={() => onMore(video)} hitSlop={8} style={styles.more} accessibilityLabel="Options">
        <Icon name="more" size={20} color={t.textSecondary} />
      </Pressable>
    </Pressable>
  );
});

export const VideoCard = memo(function VideoCard({
  video,
  index,
  width,
  onPress,
  onMore,
}: {
  video: Video;
  index: number;
  width: number;
  onPress: (i: number) => void;
  onMore: (v: Video) => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={() => onPress(index)} onLongPress={() => onMore(video)} style={{ width }}>
      <VideoThumb video={video} width={width} height={Math.round((width * 9) / 16)} radius={18} />
      <Text numberOfLines={2} style={[styles.cardTitle, { color: t.text }]}>
        {video.title}
      </Text>
      <Text numberOfLines={1} style={[styles.meta, { color: t.textSecondary, marginTop: 2 }]}>
        {[qualityLabel(video.width, video.height), formatSize(video.size)].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  duration: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressFill: { height: '100%' },
  row: { height: VIDEO_ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  rowText: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  title: { fontSize: 15.5, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  meta: { fontSize: 13 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14.5, lineHeight: 19, marginTop: 8 },
});
