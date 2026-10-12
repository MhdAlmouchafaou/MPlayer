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
import { useMedia } from '../store/media';
import { useVideos } from '../store/videos';
import { useTheme } from '../theme';

const fmtSpeed = (v: number) => `${v.toFixed(2).replace(/0$/, '').replace('.', ',')}x`;

export default function SettingsScreen() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Paramètres" />
      <SettingsContent bottomPad={110} />
    </View>
  );
}

export function SettingsContent({ bottomPad, header }: { bottomPad: number; header?: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useUserStore((s) => s.settings);
  const video = useMedia((s) => s.video);
  const pdf = useMedia((s) => s.pdf);
  const updateVideo = useMedia((s) => s.updateVideo);
  const updatePdf = useMedia((s) => s.updatePdf);
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
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + bottomPad }} showsVerticalScrollIndicator={false}>
        {header}
        <SectionLabel>Vidéo</SectionLabel>
        <Card>
          <SettingItem
            title="Lecteur vidéo par défaut"
            sub="Ouvrir les vidéos de la galerie et des autres applications avec MPlayer"
            onPress={() =>
              useUI.getState().showConfirm({
                title: 'Faire de MPlayer le lecteur par défaut',
                message:
                  'Une vidéo va s’ouvrir : choisissez « MPlayer » puis « Toujours ». Si une autre application s’ouvre directement, réinitialisez son choix par défaut dans les paramètres Android (Applications › application concernée › Ouvrir par défaut), puis réessayez.',
                confirmLabel: 'Continuer',
                onConfirm: async () => {
                  const v = useVideos.getState().videos[0];
                  if (!v) return Native?.openDefaultAppsSettings();
                  const ok = await Native?.openWithSystem(v.uri, 'video/*');
                  if (!ok) Native?.openDefaultAppsSettings();
                },
              })
            }
          />
          <SettingItem
            title="Décodeur"
            value={{ auto: 'Automatique (recommandé)', exo: 'Matériel uniquement', vlc: 'Logiciel uniquement' }[video.engine]}
            sub="En automatique, MPlayer bascule seul sur le décodeur logiciel quand le téléphone ne sait pas lire un fichier."
            onRef={(v) => (refs.current.engine = v)}
            onPress={() =>
              openMenu('engine', 'Décodeur', [
                { label: 'Automatique (recommandé)', checked: video.engine === 'auto', onPress: () => updateVideo({ engine: 'auto' }) },
                { label: 'Matériel uniquement', checked: video.engine === 'exo', onPress: () => updateVideo({ engine: 'exo' }) },
                { label: 'Logiciel uniquement', checked: video.engine === 'vlc', onPress: () => updateVideo({ engine: 'vlc' }) },
              ])
            }
          />
          <SettingItem
            title="Gestes sur la vidéo"
            sub="Luminosité à gauche, volume à droite, glisser pour avancer, appui long pour accélérer"
            onPress={() => updateVideo({ gestures: !video.gestures })}
            right={<Switch value={video.gestures} onChange={(v) => updateVideo({ gestures: v })} />}
          />
          <SettingItem
            title="Double appui pour avancer ou reculer"
            value={`${video.doubleTapSeconds} secondes`}
            onRef={(v) => (refs.current.tap = v)}
            onPress={() =>
              openMenu(
                'tap',
                'Saut au double appui',
                [5, 10, 15, 30].map((n) => ({ label: `${n} secondes`, checked: video.doubleTapSeconds === n, onPress: () => updateVideo({ doubleTapSeconds: n }) }))
              )
            }
          />
          <SettingItem
            title="Format de l’image par défaut"
            value={{ fit: 'Ajuster', fill: 'Remplir l’écran', stretch: 'Étirer', '16:9': '16:9', '4:3': '4:3' }[video.resizeMode]}
            onRef={(v) => (refs.current.resize = v)}
            onPress={() =>
              openMenu(
                'resize',
                'Format',
                (['fit', 'fill', 'stretch', '16:9', '4:3'] as const).map((k) => ({
                  label: { fit: 'Ajuster', fill: 'Remplir l’écran', stretch: 'Étirer', '16:9': '16:9', '4:3': '4:3' }[k],
                  checked: video.resizeMode === k,
                  onPress: () => updateVideo({ resizeMode: k }),
                }))
              )
            }
          />
          <SettingItem
            title="Reprendre là où je me suis arrêté"
            onPress={() => updateVideo({ resume: !video.resume })}
            right={<Switch value={video.resume} onChange={(v) => updateVideo({ resume: v })} />}
          />
          <SettingItem
            title="Enchaîner la vidéo suivante"
            onPress={() => updateVideo({ autoNext: !video.autoNext })}
            right={<Switch value={video.autoNext} onChange={(v) => updateVideo({ autoNext: v })} />}
          />
          <SettingItem
            title="Rotation automatique"
            sub="Paysage ou portrait selon la forme de la vidéo"
            onPress={() => updateVideo({ autoRotate: !video.autoRotate })}
            right={<Switch value={video.autoRotate} onChange={(v) => updateVideo({ autoRotate: v })} />}
          />
          <SettingItem
            title="Image dans l’image automatique"
            sub="La vidéo continue en petite fenêtre quand vous quittez l’application"
            onPress={() => updateVideo({ autoPip: !video.autoPip })}
            right={<Switch value={video.autoPip} onChange={(v) => updateVideo({ autoPip: v })} />}
          />
          <SettingItem
            title="Son en arrière-plan"
            sub="Continuer le son d’une vidéo écran éteint ou dans une autre application"
            onPress={() => updateVideo({ background: !video.background })}
            right={<Switch value={video.background} onChange={(v) => updateVideo({ background: v })} />}
          />
          <SettingItem
            title="Mémoriser la luminosité des vidéos"
            onPress={() => updateVideo({ rememberBrightness: !video.rememberBrightness })}
            right={<Switch value={video.rememberBrightness} onChange={(v) => updateVideo({ rememberBrightness: v })} />}
          />
          <SettingItem
            title="Dossiers vidéo masqués"
            value={video.hiddenFolders.length ? `${video.hiddenFolders.length} masqué(s) — toucher pour tout réafficher` : 'Aucun'}
            onPress={() => {
              if (!video.hiddenFolders.length) return;
              updateVideo({ hiddenFolders: [] });
              useVideos.getState().scan();
              toast('Tous les dossiers vidéo sont de nouveau visibles');
            }}
          />
          <SettingItem
            title="Effacer l’historique des vidéos"
            last
            onPress={() =>
              useUI.getState().showConfirm({
                title: 'Effacer l’historique ?',
                message: 'Les positions de reprise seront oubliées.',
                confirmLabel: 'Effacer',
                destructive: true,
                onConfirm: () => {
                  useMedia.getState().clearHistory();
                  toast('Historique effacé');
                },
              })
            }
          />
        </Card>

        <SectionLabel>Documents PDF</SectionLabel>
        <Card>
          <SettingItem
            title="Affichage"
            value={['Normal', 'Mode nuit', 'Sépia'][pdf.mode]}
            onRef={(v) => (refs.current.pdfmode = v)}
            onPress={() =>
              openMenu('pdfmode', 'Affichage', [
                { label: 'Normal', checked: pdf.mode === 0, onPress: () => updatePdf({ mode: 0 }) },
                { label: 'Mode nuit', checked: pdf.mode === 1, onPress: () => updatePdf({ mode: 1 }) },
                { label: 'Sépia', checked: pdf.mode === 2, onPress: () => updatePdf({ mode: 2 }) },
              ])
            }
          />
          <SettingItem
            title="Page par page (horizontal)"
            onPress={() => updatePdf({ horizontal: !pdf.horizontal })}
            right={<Switch value={pdf.horizontal} onChange={(v) => updatePdf({ horizontal: v })} />}
          />
          <SettingItem
            title="Garder l’écran allumé pendant la lecture"
            onPress={() => updatePdf({ keepAwake: !pdf.keepAwake })}
            right={<Switch value={pdf.keepAwake} onChange={(v) => updatePdf({ keepAwake: v })} />}
          />
          <SettingItem
            title="Accès à tous les fichiers"
            sub="Nécessaire pour lister tous les PDF du téléphone"
            last
            onPress={() => Native?.requestAllFilesAccess()}
          />
        </Card>

        <SectionLabel>Musique</SectionLabel>

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
          <SettingItem title="MPlayer" sub={`Version ${Constants.expoConfig?.version ?? '1.0.0'} · vidéo, musique et PDF`} last />
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
