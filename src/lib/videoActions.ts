import { router } from 'expo-router';
import { Native } from '../../modules/mplayer-core';
import { useMedia } from '../store/media';
import { toast, useUI } from '../store/ui';
import { useVideo, type VItem } from '../store/video';
import { useVideos, type Video } from '../store/videos';
import { displayFolder, formatSize, formatTime } from '../utils';
import { qualityLabel } from '../components/video/VideoItems';
import { moveToVault } from './vaultActions';

export const toVItem = (v: Video): VItem => ({
  key: v.key,
  uri: v.uri,
  title: v.title,
  id: v.id,
  folder: v.folder,
  duration: v.duration,
  width: v.width,
  height: v.height,
});

/** Opens the player on a list of videos (the rest of the list becomes the playlist). */
export function playVideos(list: Video[], index: number, opts?: { startMs?: number }) {
  useVideo.getState().open(list.map(toVItem), index, opts);
  router.push('/video');
}

/** Opens any uri (file picked, shared from another app, stream). */
export async function playUri(uri: string, title?: string) {
  let name = title;
  if (!name && Native) name = (await Native.describeUri(uri).catch(() => null))?.name;
  const known = Object.values(useVideos.getState().byKey).find((v) => v.uri === uri);
  const item: VItem = known
    ? toVItem(known)
    : { key: `u:${uri}`, uri, title: (name ?? uri.split('/').pop() ?? 'Vidéo').replace(/\.[^.]+$/, '') };
  useVideo.getState().open([item], 0);
  router.push('/video');
}

export async function showVideoDetails(v: Video) {
  const info = Native ? await Native.probe(v.uri).catch(() => ({} as Record<string, string | null>)) : {};
  const fps = info.frameRate ? `${Math.round(Number(info.frameRate))} i/s` : null;
  const br = info.bitrate ? `${(Number(info.bitrate) / 1e6).toFixed(1).replace('.', ',')} Mb/s` : null;
  const hdr = info.colorTransfer === '6' ? 'HDR10 / PQ' : info.colorTransfer === '7' ? 'HLG (HDR)' : null;
  useUI.getState().showSheet({
    title: 'Détails',
    subtitle: v.title,
    actions: [],
    details: [
      { label: 'Nom du fichier', value: v.fileName },
      { label: 'Durée', value: formatTime(v.duration) },
      { label: 'Résolution', value: `${v.width} × ${v.height}${qualityLabel(v.width, v.height) ? ` (${qualityLabel(v.width, v.height)})` : ''}` },
      ...(fps ? [{ label: 'Images par seconde', value: fps }] : []),
      ...(br ? [{ label: 'Débit', value: br }] : []),
      ...(hdr ? [{ label: 'Plage dynamique', value: hdr }] : []),
      { label: 'Format', value: (v.mimeType.split('/')[1] || v.mimeType || '—').toUpperCase() },
      { label: 'Taille', value: formatSize(v.size) },
      { label: 'Emplacement', value: displayFolder(v.path) },
      { label: 'Ajoutée le', value: new Date(v.dateAdded * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
    ],
  });
}

export function openVideoMenu(v: Video, list?: Video[]) {
  const media = useMedia.getState();
  const fav = media.videoFavorites.includes(v.key);
  const hasProgress = (media.progress[v.key]?.position ?? 0) > 0;
  const siblings = list ?? [v];
  const index = Math.max(0, siblings.findIndex((x) => x.key === v.key));
  useUI.getState().showSheet({
    title: v.title,
    subtitle: [formatTime(v.duration), formatSize(v.size)].join(' · '),
    actions: [
      { label: 'Lire', icon: 'play', onPress: () => playVideos(siblings, index) },
      ...(hasProgress
        ? [{ label: 'Lire depuis le début', icon: 'replay10', onPress: () => playVideos(siblings, index, { startMs: 0 }) }]
        : []),
      {
        label: 'Écouter seulement le son',
        icon: 'headphones',
        onPress: () => {
          useMedia.getState().updateVideo({ background: true });
          playVideos(siblings, index);
          toast('Le son continuera écran éteint et en arrière-plan');
        },
      },
      {
        label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris',
        icon: fav ? 'heartFilled' : 'heart',
        onPress: () => toast(useMedia.getState().toggleVideoFavorite(v.key) ? 'Ajoutée aux favoris' : 'Retirée des favoris'),
      },
      { label: 'Ouvrir le dossier', icon: 'folder', onPress: () => router.push({ pathname: '/videos/[folder]', params: { folder: v.folder } }) },
      { label: 'Partager', icon: 'share', onPress: () => Native?.shareFile(v.uri, v.mimeType || 'video/*', v.title) },
      { label: 'Déplacer dans le dossier privé', icon: 'lock', onPress: () => moveToVault([v.uri], `« ${v.title} »`) },
      ...(hasProgress
        ? [{ label: "Effacer de l'historique", icon: 'history', onPress: () => useMedia.getState().clearProgress(v.key) }]
        : []),
      { label: 'Détails', icon: 'info', onPress: () => setTimeout(() => showVideoDetails(v), 220) },
    ],
  });
}
