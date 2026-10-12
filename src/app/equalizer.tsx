import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Native, type EqualizerInfo } from '../../modules/mplayer-core';
import { ScreenHeader, SettingItem } from '../components/SettingItem';
import { Card, SectionLabel, Slider, Switch } from '../components/ui';
import { useUserStore } from '../store/user';
import { useTheme } from '../theme';

const HEIGHT = 190;

const PRESET_FR: Record<string, string> = {
  Normal: 'Normal',
  Classical: 'Classique',
  Dance: 'Dance',
  Flat: 'Plat',
  Folk: 'Folk',
  'Heavy Metal': 'Metal',
  'Hip Hop': 'Hip-hop',
  Jazz: 'Jazz',
  Pop: 'Pop',
  Rock: 'Rock',
};

function BandSlider({
  level,
  min,
  max,
  disabled,
  onCommit,
}: {
  level: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const t = useTheme();
  const ratio = useSharedValue((level - min) / (max - min || 1));
  const dragging = useSharedValue(false);
  useEffect(() => {
    if (!dragging.value) ratio.value = (level - min) / (max - min || 1);
  }, [level, min, max, ratio, dragging]);

  const commit = (r: number) => onCommit(Math.round(min + r * (max - min)));
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .onBegin((e) => {
      dragging.value = true;
      ratio.value = Math.min(1, Math.max(0, 1 - e.y / HEIGHT));
    })
    .onUpdate((e) => {
      ratio.value = Math.min(1, Math.max(0, 1 - e.y / HEIGHT));
    })
    .onFinalize(() => {
      dragging.value = false;
      scheduleOnRN(commit, ratio.value);
    });

  const fill = useAnimatedStyle(() => ({ height: `${ratio.value * 100}%` }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - ratio.value) * HEIGHT - 12 }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: 36, height: HEIGHT, alignItems: 'center', opacity: disabled ? 0.45 : 1 }}>
        <View style={{ width: 12, height: HEIGHT, borderRadius: 6, backgroundColor: t.accentTrack, overflow: 'hidden', justifyContent: 'flex-end' }}>
          <Animated.View style={[{ width: '100%', backgroundColor: t.accentSoft }, fill]} />
        </View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: t.surfaceAlt,
              borderWidth: 2.5,
              borderColor: t.accentSoft,
            },
            thumb,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const fmtFreq = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 ? 1 : 0).replace('.', ',')}k` : `${hz}`);

export default function EqualizerScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const saved = useUserStore((s) => s.settings.equalizer);
  const update = useUserStore((s) => s.updateSettings);
  const [info, setInfo] = useState<EqualizerInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!Native) return setError(true);
    Native.getEqualizer()
      .then((i) => (i.available ? setInfo(i) : setError(true)))
      .catch(() => setError(true));
  }, []);

  const save = (patch: Partial<typeof saved>) => update({ equalizer: { ...useUserStore.getState().settings.equalizer, ...patch } });
  const enabled = saved.enabled;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Qualité et effets sonores" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <Card>
          <SettingItem
            title="Égaliseur"
            sub={enabled ? 'Activé' : 'Désactivé'}
            last
            onPress={() => {
              save({ enabled: !enabled });
              Native?.setEqualizerEnabled(!enabled);
            }}
            right={
              <Switch
                value={enabled}
                onChange={(v) => {
                  save({ enabled: v });
                  Native?.setEqualizerEnabled(v);
                }}
              />
            }
          />
        </Card>

        {error ? (
          <Text style={[styles.note, { color: t.textSecondary }]}>
            L'égaliseur n'est pas disponible sur cet appareil. Lancez d'abord la lecture d'un morceau, puis revenez ici.
          </Text>
        ) : !info ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <SectionLabel>Préréglages</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
              {info.presets.map((name, i) => {
                const active = saved.preset === i;
                return (
                  <Pressable
                    key={name}
                    disabled={!enabled}
                    onPress={async () => {
                      const next = await Native!.usePreset(i);
                      setInfo(next);
                      save({ preset: i, bands: next.bands.map((b) => b.level) });
                    }}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? t.accent : t.surface, opacity: enabled ? 1 : 0.5 },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : t.text, fontSize: 15 }}>{PRESET_FR[name] ?? name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <SectionLabel>Personnalisé</SectionLabel>
            <Card style={{ paddingVertical: 22 }}>
              <View style={styles.bands}>
                {info.bands.map((band) => (
                  <View key={band.index} style={{ alignItems: 'center' }}>
                    <Text style={[styles.db, { color: t.textSecondary }]}>
                      {(band.level / 100 > 0 ? '+' : '') + Math.round(band.level / 100)}
                    </Text>
                    <BandSlider
                      level={band.level}
                      min={info.minLevel}
                      max={info.maxLevel}
                      disabled={!enabled}
                      onCommit={(v) => {
                        Native?.setBandLevel(band.index, v);
                        const bands = info.bands.map((b) => (b.index === band.index ? { ...b, level: v } : b));
                        setInfo({ ...info, bands });
                        save({ preset: -1, bands: bands.map((b) => b.level) });
                      }}
                    />
                    <Text style={[styles.freq, { color: t.text }]}>{fmtFreq(band.centerFreq)}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {info.bassBoostSupported || info.virtualizerSupported ? <SectionLabel>Effets</SectionLabel> : null}
            {info.bassBoostSupported || info.virtualizerSupported ? (
              <Card>
                {info.bassBoostSupported ? (
                  <SettingItem title="Renforcement des basses" last={!info.virtualizerSupported}>
                    <Slider
                      value={saved.bass}
                      min={0}
                      max={1000}
                      onComplete={(v) => {
                        save({ bass: Math.round(v) });
                        Native?.setBassBoost(Math.round(v));
                      }}
                      trackHeight={13}
                      trackColor={t.accentTrack}
                      fillColor={t.accentSoft}
                      thumbColor={t.surfaceAlt}
                      thumbBorderColor={t.accentSoft}
                      thumbSize={26}
                      style={{ marginTop: 6, opacity: enabled ? 1 : 0.5 }}
                    />
                  </SettingItem>
                ) : null}
                {info.virtualizerSupported ? (
                  <SettingItem title="Effet d'espace (virtualiseur)" last>
                    <Slider
                      value={saved.virtualizer}
                      min={0}
                      max={1000}
                      onComplete={(v) => {
                        save({ virtualizer: Math.round(v) });
                        Native?.setVirtualizer(Math.round(v));
                      }}
                      trackHeight={13}
                      trackColor={t.accentTrack}
                      fillColor={t.accentSoft}
                      thumbColor={t.surfaceAlt}
                      thumbBorderColor={t.accentSoft}
                      thumbSize={26}
                      style={{ marginTop: 6, opacity: enabled ? 1 : 0.5 }}
                    />
                  </SettingItem>
                ) : null}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 34,
  },
  chip: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
  },
  bands: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  db: {
    fontSize: 12.5,
    marginBottom: 10,
  },
  freq: {
    fontSize: 13,
    marginTop: 12,
  },
});
