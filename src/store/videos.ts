import { create } from 'zustand';
import { Native, type NativeVideo } from '../../modules/mplayer-core';
import { check, type PermissionState } from '../lib/permissions';
import { displayFolder, folderName, sortByName } from '../utils';
import { useMedia } from './media';

export type Video = NativeVideo & { key: string };

export type VideoFolder = {
  path: string;
  name: string;
  display: string;
  videos: Video[];
  size: number;
  latest: number;
};

type VideoLibrary = {
  videos: Video[];
  byKey: Record<string, Video>;
  folders: VideoFolder[];
  loading: boolean;
  loaded: boolean;
  permission: PermissionState;
  checkPermission: () => Promise<PermissionState>;
  scan: () => Promise<void>;
};

/** Stable key for anything playable: MediaStore id when known, the uri otherwise. */
export const videoKey = (v: { id?: string; uri: string }) => (v.id ? `v:${v.id}` : `u:${v.uri}`);

export const useVideos = create<VideoLibrary>((set, get) => ({
  videos: [],
  byKey: {},
  folders: [],
  loading: false,
  loaded: false,
  permission: 'unknown',

  checkPermission: async () => {
    const ok = await check('video');
    const state: PermissionState = ok ? 'granted' : get().permission === 'blocked' ? 'blocked' : 'denied';
    set({ permission: state });
    return state;
  },

  scan: async () => {
    if (!Native) return set({ loaded: true });
    set({ loading: true });
    try {
      const hidden = new Set(useMedia.getState().video.hiddenFolders);
      const raw = await Native.queryVideos();
      const all: Video[] = raw.map((v) => ({ ...v, key: `v:${v.id}` }));
      const videos = all.filter((v) => !hidden.has(v.folder) && v.duration >= 0);
      const byKey: Record<string, Video> = {};
      for (const v of all) byKey[v.key] = v;
      const map = new Map<string, VideoFolder>();
      for (const v of videos) {
        let f = map.get(v.folder);
        if (!f) {
          f = { path: v.folder, name: folderName(v.folder), display: displayFolder(v.folder), videos: [], size: 0, latest: 0 };
          map.set(v.folder, f);
        }
        f.videos.push(v);
        f.size += v.size;
        f.latest = Math.max(f.latest, v.dateAdded);
      }
      // Camera folders first, then by name.
      const folders = sortByName([...map.values()], (f) => f.name).sort((a, b) => {
        const ca = /camera|dcim/i.test(a.path) ? 0 : 1;
        const cb = /camera|dcim/i.test(b.path) ? 0 : 1;
        return ca - cb;
      });
      set({ videos, byKey, folders, loaded: true });
    } catch (e) {
      console.warn('video scan failed', e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));
