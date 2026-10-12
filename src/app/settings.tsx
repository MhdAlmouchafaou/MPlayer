import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Native } from '../../modules/mplayer-core';
import { PopupMenu, type MenuItem } from '../components/PopupMenu';
import { ScreenHeader, SettingItem } from '../components/SettingItem';
import { Card, SectionLabel, Slider, Switch } from '../components/ui';
import { clearArtworkCache } from '../lib/artwork';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { toast, useUI } from '../store/ui';
import { useUserStore } from '../store/user';
import { useTheme } from '../theme';

const fmtSpeed = (v: number) => `${v.toFixed(2).replace(/0$/, '').replace('.', ',')}x`;

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useUserStore((s) => s.settings);
  const update = useUserStore((s) => s.updateSettings);
  const hiddenCount = useUserStore((s) => s.hiddenFolders.length);
  const sleepEndsAt = usePlayer((s) => s.sleepEndsAt);
  const sleepEndOfTrack = usePlayer((s) => s.sleepEndOfTrack);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const [speed, setSpeed] = useState(settings.speed);
  const [fade, setFade] = useState(settings.fadeSec);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; title?: string } | null>(null);
  const refs = useRef<Record<string, View | null>>({});

  const openMenu = (key: string, title: string, items: MenuItem[]) => {
    refs.current[key]?.measureInWindow((x, y, w, h) => setMenu({ x: x + w - 16, y: y + h / 2, items, title }));
  };

  const sleepLabel = sleepEndOfTrack
    ? 'À la fin du morceau'
    : sleepEndsAt
      ? `Arrêt dans ${Math.max(1, Math.round((sleepEndsAt - Date.now()) / 60000))} min`
      : 'Désactivé';

  const themeLabel = { system: 'Selon le système', light: 'Clair', dark: 'Sombre' }[settings.theme];
  const minLabel = settings.minDurationSec ? `Masquer les audios de moins de ${settings.minDurationSec} s` : 'Afficher tous les audios';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Paramètres MPlayer" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <SectionLabel>Lecture</SectionLabel>
        <Card>
          <SettingItem
            title="Mise en veille"
            value={sleepLabel}
            onRef={(v) => (refs.current.sleep = v)}
            onPress={() =>
              openMenu('sleep', 'Mise en veille', [
                { label: 'Désactivé', checked: !sleepEndsAt && !sleepEndOfTrack, onPress: () => setSleepTimer(null) },
                ...[15, 30, 45, 60, 90, 120].map((m) => ({
                  label: m < 60 ? `${m} minutes` : m === 60 ? '1 heure' : m === 90 ? '1 h 30' : '2 heures',
                  onPress: () => {
                    setSleepTimer(m);
                    toast(`Arrêt programmé dans ${m} min`);
                  },
                })),
                { label: 'À la fin du morceau', checked: sleepEndOfTrack, onPress: () => setSleepTimer('end') },
              ])
            }
          />
          <SettingItem title="Vitesse de lecture">
            <Text style={{ color: t.accent, fontSize: 15, textAlign: 'center', marginTop: 10 }}>{fmtSpeed(speed)}</Text>
            <Slider
              value={speed}
              min={0.5}
              max={2}
              step={0.05}
              onChange={setSpeed}
              onComplete={(v) => {
                setSpeed(v);
                update({ speed: v });
                Native?.setSpeed(v);
              }}
              trackHeight={13}
              trackColor={t.accentTrack}
              fillColor={t.accentSoft}
              thumbColor={t.surfaceAlt}
              thumbBorderColor={t.accentSoft}
              thumbSize={26}
              style={{ marginHorizontal: 12 }}
            />
          </SettingItem>
          <SettingItem title="Fondu entre les morceaux">
            <Text style={{ color: t.accent, fontSize: 15, textAlign: 'center', marginTop: 10 }}>
              {fade ? `${fade} s` : 'Désactivé'}
            </Text>
            <Slider
              value={fade}
              min={0}
              max={12}
              step={1}
              onChange={setFade}
              onComplete={(v) => {
                setFade(v);
                update({ fadeSec: v });
                Native?.setFade(v * 1000);
              }}
              trackHeight={13}
              trackColor={t.accentTrack}
              fillColor={t.accentSoft}
              thumbColor={t.surfaceAlt}
              thumbBorderColor={t.accentSoft}
              thumbSize={26}
              style={{ marginHorizontal: 12 }}
            />
          </SettingItem>
          <SettingItem
            title="Saut du silence entre morceaux"
            onPress={() => {
              update({ skipSilence: !settings.skipSilence });
              Native?.setSkipSilence(!settings.skipSilence);
            }}
            right={
              <Switch
                value={settings.skipSilence}
                onChange={(v) => {
                  update({ skipSilence: v });
                  Native?.setSkipSilence(v);
                }}
              />
            }
          />
          <SettingItem
            title="Pause au débranchement du casque"
            sub="Met la lecture en pause si les écouteurs se déconnectent"
            last
            onPress={() => {
              update({ pauseOnNoisy: !settings.pauseOnNoisy });
              Native?.setPauseOnNoisy(!settings.pauseOnNoisy);
            }}
            right={
              <Switch
                value={settings.pauseOnNoisy}
                onChange={(v) => {
                  update({ pauseOnNoisy: v });
                  Native?.setPauseOnNoisy(v);
                }}
              />
            }
          />
        </Card>

        <SectionLabel>Listes de lecture</SectionLabel>
        <Card>
          <SettingItem
            title="Paramètres de la file d'attente"
            value={settings.queueMode === 'all' ? 'Lire tous les morceaux' : 'Lire uniquement le morceau choisi'}
            onRef={(v) => (refs.current.queue = v)}
            onPress={() =>
              openMenu('queue', "File d'attente", [
                { label: 'Lire tous les morceaux', checked: settings.queueMode === 'all', onPress: () => update({ queueMode: 'all' }) },
                {
                  label: 'Lire uniquement le morceau choisi',
                  checked: settings.queueMode === 'single',
                  onPress: () => update({ queueMode: 'single' }),
                },
              ])
            }
          />
          <SettingItem
            title="Interdiction morceaux dupliqués"
            sub="Interdire doublons dans file att."
            onPress={() => update({ noDuplicates: !settings.noDuplicates })}
            right={<Switch value={settings.noDuplicates} onChange={(v) => update({ noDuplicates: v })} />}
          />
          <SettingItem
            title="Effacer l'historique d'écoute"
            sub="Vide « Écoutés récemment » et « Les plus écoutés »"
            last
            onPress={() =>
              useUI.getState().showConfirm({
                title: "Effacer l'historique ?",
                confirmLabel: 'Effacer',
                destructive: true,
                onConfirm: () => {
                  useUserStore.getState().clearHistory();
                  toast('Historique effacé');
                },
              })
            }
          />
        </Card>

        <SectionLabel>Général</SectionLabel>
        <Card>
          <SettingItem title="Gérer les onglets" onPress={() => router.push('/tabs')} />
          <SettingItem title="Qualité et effets sonores" onPress={() => router.push('/equalizer')} />
          <SettingItem
            title="Thème"
            value={themeLabel}
            onRef={(v) => (refs.current.theme = v)}
            onPress={() =>
              openMenu('theme', 'Thème', [
                { label: 'Selon le système', checked: settings.theme === 'system', onPress: () => update({ theme: 'system' }) },
                { label: 'Clair', checked: settings.theme === 'light', onPress: () => update({ theme: 'light' }) },
                { label: 'Sombre', checked: settings.theme === 'dark', onPress: () => update({ theme: 'dark' }) },
              ])
            }
          />
          <SettingItem
            title="Audios courts"
            value={minLabel}
            onRef={(v) => (refs.current.min = v)}
            onPress={() =>
              openMenu(
                'min',
                'Ignorer les audios courts',
                [0, 10, 30, 60].map((sec) => ({
                  label: sec ? `Moins de ${sec} secondes` : 'Tout afficher',
                  checked: settings.minDurationSec === sec,
                  onPress: () => {
                    update({ minDurationSec: sec });
                    setTimeout(() => useLibrary.getState().scan(), 50);
                  },
                }))
              )
            }
          />
          <SettingItem
            title="Dossiers masqués"
            value={hiddenCount ? `${hiddenCount} masqué${hiddenCount > 1 ? 's' : ''}` : 'Aucun'}
            onPress={() => router.push('/hidden-folders')}
          />
          <SettingItem
            title="Actualiser la bibliothèque"
            sub="Rechercher les nouveaux fichiers et pochettes"
            last
            onPress={async () => {
              await Native?.clearArtworkMisses();
              clearArtworkCache();
              await useLibrary.getState().scan();
              toast(`${useLibrary.getState().tracks.length} pistes trouvées`);
            }}
          />
        </Card>

        <SectionLabel>À propos</SectionLabel>
        <Card>
          <SettingItem title="MPlayer" sub={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`} last />
        </Card>
      </ScrollView>
      <PopupMenu
        visible={!!menu}
        anchor={menu ? { x: menu.x, y: menu.y, align: 'right' } : null}
        title={menu?.title}
        items={menu?.items ?? []}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}
