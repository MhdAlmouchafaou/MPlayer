import { router } from 'expo-router';
import { Native } from '../../modules/mplayer-core';
import { useLibrary, type Track } from '../store/library';
import { usePlayer } from '../store/player';
import { toast, useUI, type SheetAction } from '../store/ui';
import { useUserStore } from '../store/user';
import { albumOf, artistOf, displayFolder, formatSize, formatTime, plural } from '../utils';

function closePlayerThen(fn: () => void) {
  if (useUI.getState().playerOpen) {
    useUI.getState().setPlayerOpen(false);
    setTimeout(fn, 260);
  } else fn();
}

export function openCollection(type: 'album' | 'artist' | 'folder' | 'playlist' | 'smart', id: string) {
  closePlayerThen(() => router.push({ pathname: '/collection/[type]/[id]', params: { type, id } }));
}

export function albumIdOf(track: Track) {
  return track.album ? `${track.album}\u0000${track.albumId}` : `__unknown__${track.folder}`;
}

export function showTrackDetails(track: Track) {
  useUI.getState().showSheet({
    title: 'Détails',
    track,
    actions: [],
    details: [
      { label: 'Titre', value: track.title },
      { label: 'Artiste', value: artistOf(track) },
      { label: 'Album', value: albumOf(track) },
      { label: 'Durée', value: formatTime(track.duration) },
      ...(track.year ? [{ label: 'Année', value: String(track.year) }] : []),
      ...(track.genre ? [{ label: 'Genre', value: track.genre }] : []),
      { label: 'Format', value: (track.mimeType.split('/')[1] || track.mimeType || '—').toUpperCase() },
      { label: 'Taille', value: formatSize(track.size) },
      { label: 'Emplacement', value: displayFolder(track.path) },
      { label: 'Lectures', value: String(useUserStore.getState().playCounts[track.id] ?? 0) },
    ],
  });
}

type Ctx = { playlistId?: string; playlistIndex?: number; queueIndex?: number; hideGoTo?: boolean };

export function trackActions(track: Track, ctx: Ctx = {}): SheetAction[] {
  const player = usePlayer.getState();
  const user = useUserStore.getState();
  const fav = user.favorites.includes(track.id);
  const actions: SheetAction[] = [];

  if (ctx.queueIndex === undefined) {
    actions.push(
      {
        label: 'Lire ensuite',
        icon: 'playNext',
        onPress: () => {
          player.playNext([track]);
          toast('Sera lu ensuite');
        },
      },
      {
        label: "Ajouter à la file d'attente",
        icon: 'addQueue',
        onPress: () => {
          player.addToQueue([track]);
          toast("Ajouté à la file d'attente");
        },
      }
    );
  }
  actions.push(
    {
      label: 'Ajouter à une liste de lecture',
      icon: 'plus',
      onPress: () => useUI.getState().pickPlaylist([track.id]),
    },
    {
      label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris',
      icon: fav ? 'heartFilled' : 'heart',
      onPress: () => {
        user.toggleFavorite(track.id);
        toast(fav ? 'Retiré des favoris' : 'Ajouté aux favoris');
      },
    }
  );
  if (ctx.queueIndex !== undefined) {
    const qi = ctx.queueIndex;
    actions.push({
      label: "Retirer de la file d'attente",
      icon: 'close',
      onPress: () => usePlayer.getState().removeFromQueue(qi),
    });
  }
  if (ctx.playlistId !== undefined && ctx.playlistIndex !== undefined) {
    const { playlistId, playlistIndex } = ctx;
    actions.push({
      label: 'Retirer de cette liste',
      icon: 'trash',
      onPress: () => user.removeFromPlaylist(playlistId, playlistIndex),
    });
  }
  if (!ctx.hideGoTo) {
    actions.push(
      { label: "Aller à l'album", icon: 'disc', onPress: () => openCollection('album', albumIdOf(track)) },
      { label: "Aller à l'artiste", icon: 'person', onPress: () => openCollection('artist', track.artist || 'Inconnu') },
      { label: 'Ouvrir le dossier', icon: 'folder', onPress: () => openCollection('folder', track.folder) }
    );
  }
  actions.push(
    {
      label: 'Partager',
      icon: 'share',
      onPress: () => Native?.shareTrack(track.uri, track.title).catch(() => toast('Partage impossible')),
    },
    { label: 'Détails', icon: 'info', onPress: () => setTimeout(() => showTrackDetails(track), 220) }
  );
  return actions;
}

export function openTrackMenu(track: Track, ctx: Ctx = {}) {
  useUI.getState().showSheet({
    title: track.title,
    subtitle: artistOf(track),
    track,
    actions: trackActions(track, ctx),
  });
}

/** Actions for a whole collection (album, artist, folder, playlist). */
export function collectionActions(tracks: Track[], extra: SheetAction[] = []): SheetAction[] {
  const player = usePlayer.getState();
  return [
    { label: 'Lire', icon: 'play', onPress: () => player.playTracks(tracks, 0, { shuffle: false }) },
    { label: 'Lecture aléatoire', icon: 'shuffle', onPress: () => player.playTracks(tracks, 0, { shuffle: true }) },
    {
      label: 'Lire ensuite',
      icon: 'playNext',
      onPress: () => {
        player.playNext(tracks);
        toast(`${plural(tracks.length, 'piste', 'pistes')} lues ensuite`);
      },
    },
    {
      label: "Ajouter à la file d'attente",
      icon: 'addQueue',
      onPress: () => {
        player.addToQueue(tracks);
        toast(`${plural(tracks.length, 'piste ajoutée', 'pistes ajoutées')}`);
      },
    },
    {
      label: 'Ajouter à une liste de lecture',
      icon: 'plus',
      onPress: () => useUI.getState().pickPlaylist(tracks.map((t) => t.id)),
    },
    ...extra,
  ];
}

export function createPlaylistFlow(trackIds: string[] = [], then?: (id: string) => void) {
  useUI.getState().showPrompt({
    title: 'Nouvelle liste de lecture',
    placeholder: 'Nom de la liste',
    initial: `Liste ${useUserStore.getState().playlists.length + 1}`,
    confirmLabel: 'Créer',
    onSubmit: (name) => {
      const id = useUserStore.getState().createPlaylist(name, trackIds);
      toast(trackIds.length ? `${plural(trackIds.length, 'piste ajoutée', 'pistes ajoutées')} à « ${name} »` : 'Liste créée');
      then?.(id);
    },
  });
}

export function hideFolder(path: string) {
  useUserStore.getState().setHiddenFolder(path, true);
  useLibrary.getState().scan();
  toast('Dossier masqué');
}
