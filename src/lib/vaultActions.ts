import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Native, type VaultItem } from '../../modules/mplayer-core';
import { useLibrary, type Track } from '../store/library';
import { usePlayer } from '../store/player';
import { toast, useUI } from '../store/ui';
import { useVault } from '../store/vault';
import { useVideo } from '../store/video';
import { useVideos } from '../store/videos';
import { useDocs } from '../store/docs';
import { plural } from '../utils';

/** Lets the next trip outside the app (system picker, share sheet…) keep the vault open. */
export function allowLeaving(ms = 10 * 60_000) {
  useVault.setState({ leaveAllowedUntil: Date.now() + ms });
}

/**
 * Moves files into the private folder. Without "all files" access Android does not let
 * us delete the originals, so we ask first; the user can still choose to only copy.
 */
export async function moveToVault(uris: string[], label?: string) {
  if (!Native || !uris.length) return;
  const status = await Native.vaultStatus();
  if (!status.hasPin) {
    useUI.getState().showConfirm({
      title: 'Configurer le dossier privé',
      message: 'Créez d’abord votre code d’accès dans Paramètres › Dossier privé.',
      confirmLabel: 'Configurer',
      onConfirm: () => router.push('/vault'),
    });
    return;
  }
  const allFiles = await Native.hasAllFilesAccess();
  const run = async (remove: boolean) => {
    toast(`Protection de ${label ?? plural(uris.length, 'fichier', 'fichiers')}…`);
    const res = await Native!.vaultImport(uris, remove);
    const ok = res.filter((r) => r.ok);
    const kept = ok.filter((r) => !r.removed).length;
    useVault.getState().refresh();
    // The originals are gone: refresh the libraries so they disappear from the lists.
    useVideos.getState().scan();
    useLibrary.getState().scan();
    useDocs.getState().loaded && useDocs.getState().scan();
    if (!ok.length) return toast('Aucun fichier n’a pu être protégé');
    toast(
      kept && remove
        ? `${plural(ok.length, 'fichier protégé', 'fichiers protégés')} · ${kept} original(aux) non supprimé(s)`
        : remove
          ? `${plural(ok.length, 'fichier déplacé', 'fichiers déplacés')} dans le dossier privé`
          : `${plural(ok.length, 'copie protégée', 'copies protégées')} (originaux conservés)`
    );
  };
  if (allFiles) return run(true);
  useUI.getState().showConfirm({
    title: 'Masquer les originaux ?',
    message:
      'Pour retirer les fichiers de la galerie et des autres applications, MPlayer doit pouvoir « gérer tous les fichiers ». Sans cette autorisation, seule une copie protégée est créée.',
    confirmLabel: 'Autoriser',
    onConfirm: () => {
      allowLeaving(5 * 60_000);
      Native!.requestAllFilesAccess();
      toast('Activez l’autorisation puis recommencez');
    },
  });
}

export async function pickIntoVault() {
  try {
    allowLeaving();
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: false });
    useVault.setState({ leaveAllowedUntil: 0 });
    if (res.canceled || !res.assets?.length) return;
    await moveToVault(res.assets.map((a) => a.uri));
  } catch {
    toast('Sélection impossible');
  }
}

export function openVaultItem(item: VaultItem, all: VaultItem[]) {
  useVault.setState({ openMedia: true });
  if (item.kind === 'video') {
    const videos = all.filter((i) => i.kind === 'video');
    const index = Math.max(0, videos.findIndex((v) => v.id === item.id));
    useVideo.getState().open(
      videos.map((v) => ({ key: `vault:${v.id}`, uri: v.uri, title: v.name.replace(/\.[^.]+$/, '') })),
      index
    );
    router.push('/video');
  } else if (item.kind === 'audio') {
    const audios = all.filter((i) => i.kind === 'audio');
    const tracks: Track[] = audios.map((a) => ({
      id: `vault:${a.id}`,
      uri: a.uri,
      title: a.name.replace(/\.[^.]+$/, ''),
      artist: 'Dossier privé',
      album: '',
      albumId: '0',
      artistId: '0',
      duration: 0,
      path: '',
      folder: '',
      fileName: a.name,
      dateAdded: a.added / 1000,
      size: a.size,
      mimeType: a.mime,
      trackNumber: 0,
      year: 0,
      genre: '',
    }));
    useLibrary.setState((s) => {
      const byId = { ...s.byId };
      for (const t of tracks) byId[t.id] = t;
      return { byId };
    });
    usePlayer.getState().playTracks(tracks, Math.max(0, audios.findIndex((a) => a.id === item.id)));
    useUI.getState().setPlayerOpen(true);
  } else if (item.kind === 'pdf') {
    router.push({ pathname: '/pdf', params: { uri: item.uri, name: item.name } });
  } else if (item.kind === 'image') {
    router.push({ pathname: '/vault-image', params: { id: item.id } });
  } else {
    allowLeaving();
    Native?.openWithSystem(item.uri, item.mime).then((ok) => !ok && toast('Aucune application pour ouvrir ce fichier'));
  }
}

/** Stops anything playing from the vault (used when the vault locks). */
export function stopVaultMedia() {
  const v = useVideo.getState();
  if (v.active && v.items[v.index]?.key.startsWith('vault:')) v.close(false);
  const p = usePlayer.getState();
  if (p.queue.some((id) => id.startsWith('vault:'))) p.clearQueue();
  useUI.getState().setPlayerOpen(false);
  // Forget the private tracks that were registered for playback.
  useLibrary.setState((s) => {
    const byId = { ...s.byId };
    for (const k of Object.keys(byId)) if (k.startsWith('vault:')) delete byId[k];
    return { byId };
  });
}
