import { PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';
import { Native, type NativeTrack } from '../../modules/mplayer-core';
import { cleanTrackNames, displayFolder, folderName, sortByName, UNKNOWN } from '../utils';
import { useUserStore } from './user';

export type Track = NativeTrack;

export type Album = {
  id: string;
  name: string;
  artist: string;
  trackIds: string[];
  coverTrack: Track;
  duration: number;
};

export type Artist = {
  id: string;
  name: string;
  trackIds: string[];
  albumCount: number;
  coverTrack: Track;
};

export type Folder = {
  path: string;
  name: string;
  display: string;
  trackIds: string[];
  coverTrack: Track;
};

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

type LibraryState = {
  tracks: Track[];
  byId: Record<string, Track>;
  albums: Album[];
  artists: Artist[];
  folders: Folder[];
  loading: boolean;
  loaded: boolean;
  permission: PermissionState;
  checkPermission: () => Promise<PermissionState>;
  requestPermission: () => Promise<PermissionState>;
  scan: () => Promise<void>;
};

const audioPermission =
  Platform.OS === 'android' && Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

function derive(tracks: Track[]) {
  const albumMap = new Map<string, Album>();
  const artistMap = new Map<string, { a: Artist; albums: Set<string> }>();
  const folderMap = new Map<string, Folder>();

  for (const t of tracks) {
    const albumKey = t.album ? `${t.album}\u0000${t.albumId}` : `__unknown__${t.folder}`;
    let album = albumMap.get(albumKey);
    if (!album) {
      album = {
        id: albumKey,
        name: t.album || UNKNOWN,
        artist: t.artist || UNKNOWN,
        trackIds: [],
        coverTrack: t,
        duration: 0,
      };
      albumMap.set(albumKey, album);
    } else if (album.artist !== (t.artist || UNKNOWN)) {
      album.artist = 'Artistes variés';
    }
    album.trackIds.push(t.id);
    album.duration += t.duration;

    const artistName = t.artist || UNKNOWN;
    let artist = artistMap.get(artistName);
    if (!artist) {
      artist = { a: { id: artistName, name: artistName, trackIds: [], albumCount: 0, coverTrack: t }, albums: new Set() };
      artistMap.set(artistName, artist);
    }
    artist.a.trackIds.push(t.id);
    artist.albums.add(albumKey);

    let folder = folderMap.get(t.folder);
    if (!folder) {
      folder = {
        path: t.folder,
        name: folderName(t.folder),
        display: displayFolder(t.folder),
        trackIds: [],
        coverTrack: t,
      };
      folderMap.set(t.folder, folder);
    }
    folder.trackIds.push(t.id);
  }

  const artists = [...artistMap.values()].map(({ a, albums }) => ({ ...a, albumCount: albums.size }));
  return {
    albums: sortByName([...albumMap.values()], (a) => a.name),
    artists: sortByName(artists, (a) => a.name),
    folders: sortByName([...folderMap.values()], (f) => f.name),
  };
}

export const useLibrary = create<LibraryState>((set, get) => ({
  tracks: [],
  byId: {},
  albums: [],
  artists: [],
  folders: [],
  loading: false,
  loaded: false,
  permission: 'unknown',

  checkPermission: async () => {
    if (Platform.OS !== 'android') {
      set({ permission: 'granted' });
      return 'granted';
    }
    const ok = await PermissionsAndroid.check(audioPermission);
    const state: PermissionState = ok ? 'granted' : get().permission === 'blocked' ? 'blocked' : 'denied';
    set({ permission: state });
    return state;
  },

  requestPermission: async () => {
    if (Platform.OS !== 'android') return 'granted';
    const result = await PermissionsAndroid.request(audioPermission);
    if (Number(Platform.Version) >= 33) {
      // Needed for the playback notification; ignore the answer.
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
    const state: PermissionState =
      result === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          ? 'blocked'
          : 'denied';
    set({ permission: state });
    if (state === 'granted') await get().scan();
    return state;
  },

  scan: async () => {
    if (!Native) {
      set({ loaded: true });
      return;
    }
    set({ loading: true });
    try {
      const minMs = useUserStore.getState().settings.minDurationSec * 1000;
      const raw = (await Native.queryTracks(minMs)).map((t) => ({ ...t, ...cleanTrackNames(t.title, t.artist) }));
      const hidden = new Set(useUserStore.getState().hiddenFolders);
      const tracks = raw.filter((t) => !hidden.has(t.folder));
      const byId: Record<string, Track> = {};
      for (const t of raw) byId[t.id] = t;
      set({ tracks: sortByName(tracks, (t) => t.title), byId, ...derive(tracks), loaded: true });
    } catch (e) {
      console.warn('scan failed', e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));

export function tracksFromIds(ids: string[]): Track[] {
  const byId = useLibrary.getState().byId;
  const out: Track[] = [];
  for (const id of ids) {
    const t = byId[id];
    if (t) out.push(t);
  }
  return out;
}

/** All folders including hidden ones, for the settings screen. */
export async function allFolders(): Promise<{ path: string; display: string; count: number }[]> {
  const byId = useLibrary.getState().byId;
  const map = new Map<string, number>();
  for (const t of Object.values(byId)) map.set(t.folder, (map.get(t.folder) ?? 0) + 1);
  return sortByName(
    [...map.entries()].map(([path, count]) => ({ path, display: displayFolder(path), count })),
    (f) => folderName(f.path)
  );
}
