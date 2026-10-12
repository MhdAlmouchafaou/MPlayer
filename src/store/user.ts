import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from '../utils';

export type TabKey = 'favorites' | 'playlists' | 'tracks' | 'albums' | 'artists' | 'folders';

export const TAB_LABELS: Record<TabKey, string> = {
  favorites: 'Favoris',
  playlists: 'Listes de lecture',
  tracks: 'Pistes',
  albums: 'Albums',
  artists: 'Artistes',
  folders: 'Dossiers',
};

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type SortKey = 'name' | 'dateAdded' | 'artist' | 'album' | 'duration' | 'count';

export type Settings = {
  theme: 'system' | 'light' | 'dark';
  speed: number;
  fadeSec: number;
  skipSilence: boolean;
  pauseOnNoisy: boolean;
  queueMode: 'all' | 'single';
  noDuplicates: boolean;
  minDurationSec: number;
  tabs: { key: TabKey; visible: boolean }[];
  equalizer: { enabled: boolean; bands: number[]; preset: number; bass: number; virtualizer: number };
};

export type Session = {
  queueIds: string[];
  originalIds: string[];
  index: number;
  position: number;
  shuffle: boolean;
  repeat: 0 | 1 | 2;
};

type UserState = {
  favorites: string[];
  playlists: Playlist[];
  playCounts: Record<string, number>;
  recent: string[];
  hiddenFolders: string[];
  sorts: Record<string, { key: SortKey; desc: boolean }>;
  settings: Settings;
  session: Session | null;
  onboarded: boolean;

  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  createPlaylist: (name: string, trackIds?: string[]) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, trackIds: string[]) => number;
  removeFromPlaylist: (id: string, index: number) => void;
  movePlaylistItem: (id: string, from: number, to: number) => void;
  recordPlay: (id: string) => void;
  clearHistory: () => void;
  setHiddenFolder: (folder: string, hidden: boolean) => void;
  setSort: (list: string, key: SortKey, desc: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveSession: (s: Session | null) => void;
  setOnboarded: () => void;
};

export const DEFAULT_TABS: Settings['tabs'] = [
  { key: 'favorites', visible: true },
  { key: 'playlists', visible: true },
  { key: 'tracks', visible: true },
  { key: 'albums', visible: true },
  { key: 'artists', visible: true },
  { key: 'folders', visible: true },
];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  speed: 1,
  fadeSec: 0,
  skipSilence: false,
  pauseOnNoisy: true,
  queueMode: 'all',
  noDuplicates: true,
  minDurationSec: 10,
  tabs: DEFAULT_TABS,
  equalizer: { enabled: false, bands: [], preset: -1, bass: 0, virtualizer: 0 },
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      favorites: [],
      playlists: [],
      playCounts: {},
      recent: [],
      hiddenFolders: [],
      sorts: {},
      settings: DEFAULT_SETTINGS,
      session: null,
      onboarded: false,

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [id, ...s.favorites],
        })),
      isFavorite: (id) => get().favorites.includes(id),

      createPlaylist: (name, trackIds = []) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          playlists: [{ id, name: name.trim() || 'Nouvelle liste', trackIds, createdAt: now, updatedAt: now }, ...s.playlists],
        }));
        return id;
      },
      renamePlaylist: (id, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p)),
        })),
      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      addToPlaylist: (id, trackIds) => {
        let added = 0;
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== id) return p;
            const existing = new Set(p.trackIds);
            const fresh = trackIds.filter((t) => !existing.has(t));
            added = fresh.length;
            return { ...p, trackIds: [...p.trackIds, ...fresh], updatedAt: Date.now() };
          }),
        }));
        return added;
      },
      removeFromPlaylist: (id, index) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, trackIds: p.trackIds.filter((_, i) => i !== index), updatedAt: Date.now() } : p
          ),
        })),
      movePlaylistItem: (id, from, to) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== id) return p;
            const ids = [...p.trackIds];
            const [moved] = ids.splice(from, 1);
            ids.splice(to, 0, moved);
            return { ...p, trackIds: ids, updatedAt: Date.now() };
          }),
        })),

      recordPlay: (id) =>
        set((s) => ({
          playCounts: { ...s.playCounts, [id]: (s.playCounts[id] ?? 0) + 1 },
          recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 100),
        })),
      clearHistory: () => set({ recent: [], playCounts: {} }),

      setHiddenFolder: (folder, hidden) =>
        set((s) => ({
          hiddenFolders: hidden
            ? Array.from(new Set([...s.hiddenFolders, folder]))
            : s.hiddenFolders.filter((f) => f !== folder),
        })),
      setSort: (list, key, desc) => set((s) => ({ sorts: { ...s.sorts, [list]: { key, desc } } })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      saveSession: (session) => set({ session }),
      setOnboarded: () => set({ onboarded: true }),
    }),
    {
      name: 'mplayer-user',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UserState>;
        const settings = { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) };
        // Keep tab list valid if new tabs are added in later versions.
        const known = new Set(settings.tabs.map((t) => t.key));
        settings.tabs = [...settings.tabs, ...DEFAULT_TABS.filter((t) => !known.has(t.key))];
        return { ...current, ...p, settings };
      },
    }
  )
);
