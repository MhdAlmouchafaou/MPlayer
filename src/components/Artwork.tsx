import { Image } from 'expo-image';
import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useArtwork } from '../lib/artwork';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  trackId?: string;
  albumId?: string;
  size: number;
  radius?: number;
  quality?: number;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  placeholderColor?: string;
  iconColor?: string;
};

function ArtworkImpl({ trackId, albumId, size, radius = 14, quality, icon = 'note', style, placeholderColor, iconColor }: Props) {
  const t = useTheme();
  const px = quality ?? (size > 120 ? 512 : 192);
  const uri = useArtwork(trackId, albumId, px);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: placeholderColor ?? t.placeholder,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} recyclingKey={trackId} />
      ) : (
        <Icon name={icon} size={size * 0.42} color={iconColor ?? t.placeholderIcon} strokeWidth={icon === 'note' ? 2.6 : 2} />
      )}
    </View>
  );
}

export const Artwork = memo(ArtworkImpl);
