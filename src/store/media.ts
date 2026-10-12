import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Section = 'videos' | 'music' | 'docs';

export type VideoProgress = { position: number; duration: number; at: number };
export type Moment = { id: string; position: number; label: string; thumb?: string | null; at: number };
export type DocRecent = { uri: string; name: string; at: number; page: number; pages: number; size?: number };

export type VideoSettings = {
  engine: 'auto' | 'exo' | 'vlc';
  resizeMode: 'fit' | 'fill' | 'stretch' | '16:9' | '4:3';
  doubleTapSeconds: number;
  gestures: boolean;
  autoPip: boolean;
  background: boolean;
  autoRotate: boolean;
  resume: boolean;
  autoNext: boolean;
  subtitleScale: number;
  subtitleStyle: 'shadow' | 'box' | 'yellow';
  rememberBrightness: boolean;
  brightness: number;
  showRemaining: boolean;
  grid: boolean;
  hiddenFolders: string[];
};

export type PdfSettings = {
  mode: 0 | 1 | 2; // normal, nuit, sépia
  horizontal: boolean;
  keepAwake: boolean;
};

type MediaState = {
  section: Section;
  videoTab: number;
  docTab: number;
  progress: Record<string, VideoProgress>;
  videoFavorites: string[];
  moments: Record<string, Moment[]>;
  docRecents: DocRecent[];
  docFavorites: string[];
  docBookmarks: Record<string, number[]>;
  video: VideoSettings;
  pdf: PdfSettings;

  setSection: (s: Section) => void;
  setProgress: (key: string, position: number, duration: number) => void;
  clearProgress: (key: string) => void;
  clearHistory: () => void;
  toggleVideoFavorite: (key: string) => boolean;
  addMoment: (key: string, m: Moment) => void;
  removeMoment: (key: string, id: string) => void;
  touchDoc: (d: Omit<DocRecent, 'at'>) => void;
  setDocPage: (uri: string, page: number, pages: number) => void;
  removeDocRecent: (uri: string) => void;
  toggleDocFavorite: (uri: string) => boolean;
  toggleDocBookmark: (uri: string, page: number) => boolean;
  updateVideo: (patch: Partial<VideoSettings>) => void;
  updatePdf: (patch: Partial<PdfSettings>) => void;
};

export const DEFAULT_VIDEO: VideoSettings = {
  engine: 'auto',
  resizeMode: 'fit',
  doubleTapSeconds: 10,
  gestures: true,
  autoPip: true,
  background: false,
  autoRotate: true,
  resume: true,
  autoNext: true,
  subtitleScale: 1,
  subtitleStyle: 'shadow',
  rememberBrightness: false,
  brightness: -1,
  showRemaining: false,
  grid: false,
  hiddenFolders: [],
};

export const DEFAULT_PDF: PdfSettings = { mode: 0, horizontal: false, keepAwake: true };

export const useMedia = create<MediaState>()(
  persist(
    (set, get) => ({
      section: 'videos',
      videoTab: 0,
      docTab: 0,
      progress: {},
      videoFavorites: [],
      moments: {},
      docRecents: [],
      docFavorites: [],
      docBookmarks: {},
      video: DEFAULT_VIDEO,
      pdf: DEFAULT_PDF,

      setSection: (section) => set({ section }),
      setProgress: (key, position, duration) => {
        // Nearly finished counts as watched: next time it starts from the beginning.
        if (duration > 0 && (position > duration - 4000 || position / duration > 0.97)) {
          const { [key]: _, ...rest } = get().progress;
          set({ progress: { ...rest, [key]: { position: 0, duration, at: Date.now() } } });
          return;
        }
        set((s) => ({ progress: { ...s.progress, [key]: { position, duration, at: Date.now() } } }));
      },
      clearProgress: (key) => {
        const { [key]: _, ...rest } = get().progress;
        set({ progress: rest });
      },
      clearHistory: () => set({ progress: {} }),
      toggleVideoFavorite: (key) => {
        const on = !get().videoFavorites.includes(key);
        set((s) => ({ videoFavorites: on ? [key, ...s.videoFavorites] : s.videoFavorites.filter((k) => k !== key) }));
        return on;
      },
      addMoment: (key, m) =>
        set((s) => ({ moments: { ...s.moments, [key]: [...(s.moments[key] ?? []), m].sort((a, b) => a.position - b.position) } })),
      removeMoment: (key, id) =>
        set((s) => ({ moments: { ...s.moments, [key]: (s.moments[key] ?? []).filter((m) => m.id !== id) } })),
      touchDoc: (d) =>
        set((s) => {
          const prev = s.docRecents.find((r) => r.uri === d.uri);
          const entry: DocRecent = { ...prev, ...d, page: prev?.page ?? d.page, at: Date.now() };
          return { docRecents: [entry, ...s.docRecents.filter((r) => r.uri !== d.uri)].slice(0, 60) };
        }),
      setDocPage: (uri, page, pages) =>
        set((s) => ({ docRecents: s.docRecents.map((r) => (r.uri === uri ? { ...r, page, pages, at: Date.now() } : r)) })),
      removeDocRecent: (uri) => set((s) => ({ docRecents: s.docRecents.filter((r) => r.uri !== uri) })),
      toggleDocFavorite: (uri) => {
        const on = !get().docFavorites.includes(uri);
        set((s) => ({ docFavorites: on ? [uri, ...s.docFavorites] : s.docFavorites.filter((u) => u !== uri) }));
        return on;
      },
      toggleDocBookmark: (uri, page) => {
        const list = get().docBookmarks[uri] ?? [];
        const on = !list.includes(page);
        set((s) => ({
          docBookmarks: { ...s.docBookmarks, [uri]: on ? [...list, page].sort((a, b) => a - b) : list.filter((p) => p !== page) },
        }));
        return on;
      },
      updateVideo: (patch) => set((s) => ({ video: { ...s.video, ...patch } })),
      updatePdf: (patch) => set((s) => ({ pdf: { ...s.pdf, ...patch } })),
    }),
    {
      name: 'mplayer-media',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MediaState>;
        return {
          ...current,
          ...p,
          video: { ...DEFAULT_VIDEO, ...(p.video ?? {}) },
          pdf: { ...DEFAULT_PDF, ...(p.pdf ?? {}) },
        };
      },
    }
  )
);
