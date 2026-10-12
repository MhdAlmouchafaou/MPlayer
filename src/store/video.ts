import { create } from 'zustand';
import { Native, type QueueItem, type TrackOption, type TracksInfo } from '../../modules/mplayer-core';
import { peekVideoThumb } from '../lib/thumbs';
import { toast } from './ui';
import { useMedia } from './media';
import { usePlayer } from './player';

export type VItem = {
  key: string;
  uri: string;
  title: string;
  id?: string;
  folder?: string;
  duration?: number;
  width?: number;
  height?: number;
};

export type Engine = 'exo' | 'vlc';

type VideoSession = {
  items: VItem[];
  index: number;
  engine: Engine;
  active: boolean;
  isPlaying: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  videoW: number;
  videoH: number;
  speed: number;
  loopA: number | null;
  loopB: number | null;
  repeatOne: boolean;
  tracks: TracksInfo | null;
  vlcTracks: { audio: TrackOption[]; text: TrackOption[]; audioSelected: string; textSelected: string } | null;
  fellBack: boolean;
  error: string | null;
  ended: boolean;
  sleepAt: number | null;
  sleepEnd: boolean;

  current: () => VItem | undefined;
  open: (items: VItem[], index: number, opts?: { startMs?: number; engine?: Engine }) => Promise<void>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number, fast?: boolean) => void;
  seekBy: (deltaMs: number) => void;
  step: (forward: boolean) => Promise<void>;
  setSpeed: (speed: number) => void;
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
  switchEngine: (engine: Engine, reason?: string) => Promise<void>;
  setLoop: (a: number | null, b: number | null) => void;
  setRepeatOne: (on: boolean) => void;
  selectAudio: (id: string) => void;
  selectText: (id: string | null) => void;
  refreshTracks: () => Promise<void>;
  setSleep: (minutes: number | 'end' | null) => void;
  saveProgress: () => void;
  close: (keepPlaying?: boolean) => void;
};

const toQueueItem = (v: VItem): QueueItem => ({
  id: v.key,
  uri: v.uri,
  title: v.title,
  artist: v.folder ? v.folder.split('/').filter(Boolean).pop() ?? 'MPlayer' : 'MPlayer',
  album: '',
  albumId: '',
  kind: 'video',
  artwork: peekVideoThumb(v.id ?? v.uri, 320) ?? null,
});

let lastSave = 0;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;

export const useVideo = create<VideoSession>((set, get) => ({
  items: [],
  index: 0,
  engine: 'exo',
  active: false,
  isPlaying: false,
  buffering: false,
  position: 0,
  duration: 0,
  videoW: 16,
  videoH: 9,
  speed: 1,
  loopA: null,
  loopB: null,
  repeatOne: false,
  tracks: null,
  vlcTracks: null,
  fellBack: false,
  error: null,
  ended: false,
  sleepAt: null,
  sleepEnd: false,

  current: () => get().items[get().index],

  open: async (items, index, opts) => {
    const item = items[index];
    if (!item) return;
    get().saveProgress();
    const settings = useMedia.getState().video;
    const engine: Engine = opts?.engine ?? (settings.engine === 'vlc' ? 'vlc' : 'exo');
    const saved = useMedia.getState().progress[item.key];
    const resume = settings.resume && saved && saved.position > 3000 ? saved.position : 0;
    const startMs = opts?.startMs ?? resume;

    // Leaving music: the shared player now belongs to the video.
    if (usePlayer.getState().queue.length) {
      usePlayer.setState({ queue: [], original: [], isPlaying: false });
    }
    set({
      items,
      index,
      engine,
      active: true,
      isPlaying: true,
      buffering: true,
      position: startMs,
      duration: item.duration ?? 0,
      videoW: item.width || 16,
      videoH: item.height || 9,
      loopA: null,
      loopB: null,
      tracks: null,
      vlcTracks: null,
      fellBack: false,
      error: null,
      ended: false,
    });
    if (!Native) return;
    try {
      if (engine === 'exo') {
        await Native.vlcStop().catch(() => {});
        await Native.setQueue([toQueueItem(item)], 0, startMs, true);
        await Native.setRepeatMode(get().repeatOne ? 1 : 0);
        await Native.setSpeed(get().speed);
      } else {
        await Native.pause().catch(() => {});
        await Native.vlcOpen(item.uri, startMs, true);
        await Native.vlcSetRate(get().speed);
      }
      if (startMs > 0 && opts?.startMs === undefined) toast(`Reprise à ${fmt(startMs)}`);
    } catch (e) {
      set({ error: String((e as Error)?.message ?? e) });
    }
  },

  play: () => {
    const { engine, ended, items, index } = get();
    set({ isPlaying: true, ended: false });
    if (engine === 'vlc' && ended) {
      get().open(items, index, { startMs: 0, engine: 'vlc' });
      return;
    }
    if (engine === 'exo') {
      if (ended) Native?.seekTo(0);
      Native?.play();
    } else Native?.vlcPlay();
  },
  pause: () => {
    set({ isPlaying: false });
    if (get().engine === 'exo') Native?.pause();
    else Native?.vlcPause();
    get().saveProgress();
  },
  toggle: () => (get().isPlaying ? get().pause() : get().play()),

  seek: (ms, fast = false) => {
    const d = get().duration;
    const target = Math.max(0, d > 0 ? Math.min(ms, d - 50) : ms);
    set({ position: target, ended: false });
    if (get().engine === 'exo') Native?.seekTo(target);
    else Native?.vlcSeek(target, fast);
  },
  seekBy: (delta) => get().seek(get().position + delta),

  step: async (forward) => {
    if (!Native) return;
    set({ isPlaying: false });
    if (get().engine === 'exo') {
      const pos = await Native.stepFrame(forward);
      set({ position: pos });
    } else {
      await Native.vlcPause();
      const target = Math.max(0, get().position + (forward ? 40 : -40));
      await Native.vlcSeek(target, false);
      set({ position: target });
    }
  },

  setSpeed: (speed) => {
    set({ speed });
    if (get().engine === 'exo') Native?.setSpeed(speed);
    else Native?.vlcSetRate(speed);
  },

  next: () => {
    const { items, index } = get();
    if (index + 1 < items.length) get().open(items, index + 1, { startMs: 0 });
    else toast('Dernière vidéo du dossier');
  },
  previous: () => {
    const { items, index, position } = get();
    if (position > 5000 || index === 0) return get().seek(0);
    get().open(items, index - 1, { startMs: 0 });
  },
  goTo: (i) => get().open(get().items, i, { startMs: 0 }),

  switchEngine: async (engine, reason) => {
    const { items, index, position, engine: cur } = get();
    if (engine === cur || !items[index]) return;
    await get().open(items, index, { startMs: position, engine });
    set({ fellBack: engine === 'vlc' && !!reason });
    if (reason) toast(reason);
  },

  setLoop: (a, b) => set({ loopA: a, loopB: b }),
  setRepeatOne: (on) => {
    set({ repeatOne: on });
    if (get().engine === 'exo') Native?.setRepeatMode(on ? 1 : 0);
  },

  selectAudio: (id) => {
    if (get().engine === 'exo') Native?.selectTrack('audio', id).then(() => setTimeout(() => get().refreshTracks(), 300));
    else Native?.vlcSelectAudio(Number(id)).then(() => get().refreshTracks());
  },
  selectText: (id) => {
    if (get().engine === 'exo') Native?.selectTrack('text', id).then(() => setTimeout(() => get().refreshTracks(), 300));
    else Native?.vlcSelectText(id === null ? -1 : Number(id)).then(() => get().refreshTracks());
  },
  refreshTracks: async () => {
    if (!Native) return;
    if (get().engine === 'exo') set({ tracks: await Native.getTracks().catch(() => null) });
    else set({ vlcTracks: await Native.vlcTracks().catch(() => null) });
  },

  setSleep: (minutes) => {
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = null;
    if (minutes === null) return set({ sleepAt: null, sleepEnd: false });
    if (minutes === 'end') return set({ sleepAt: null, sleepEnd: true });
    set({ sleepAt: Date.now() + minutes * 60000, sleepEnd: false });
    sleepTimer = setTimeout(() => {
      get().pause();
      set({ sleepAt: null });
      toast('Mise en veille : lecture arrêtée');
    }, minutes * 60000);
  },

  saveProgress: () => {
    const { items, index, position, duration, active } = get();
    const item = items[index];
    if (!active || !item || duration <= 0) return;
    lastSave = Date.now();
    useMedia.getState().setProgress(item.key, position, duration);
  },

  close: (keepPlaying = false) => {
    get().saveProgress();
    if (!keepPlaying) {
      if (get().engine === 'exo') Native?.stop();
      else Native?.vlcStop();
      set({ active: false, isPlaying: false });
    }
    Native?.releaseFrames().catch(() => {});
  },
}));

export function fmt(ms: number, withMs = false) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return withMs ? `${base}.${String(Math.floor(ms % 1000)).padStart(3, '0')}` : base;
}

function onEnded() {
  const s = useVideo.getState();
  s.saveProgress();
  if (s.sleepEnd) {
    useVideo.setState({ sleepEnd: false, isPlaying: false, ended: true });
    return;
  }
  if (s.repeatOne) return s.seek(0);
  const auto = useMedia.getState().video.autoNext;
  if (auto && s.index + 1 < s.items.length) s.open(s.items, s.index + 1, { startMs: 0 });
  else useVideo.setState({ isPlaying: false, ended: true });
}

function onPosition(position: number, duration: number) {
  const s = useVideo.getState();
  const patch: Partial<VideoSession> = { position };
  if (duration > 0) patch.duration = duration;
  useVideo.setState(patch);
  if (s.loopA !== null && s.loopB !== null && position >= s.loopB) s.seek(s.loopA);
  if (Date.now() - lastSave > 5000) s.saveProgress();
}

/** Routes native events for videos (both engines) to the session store. */
export function attachVideoEvents() {
  if (!Native) return () => {};
  const isVideo = (e: { kind?: string }) => e.kind === 'video';
  const exo = () => useVideo.getState().engine === 'exo' && useVideo.getState().active;
  const vlc = () => useVideo.getState().engine === 'vlc' && useVideo.getState().active;
  const subs = [
    Native.addListener('onProgress', (e) => {
      if (isVideo(e) && exo()) onPosition(e.position, e.duration);
    }),
    Native.addListener('onPlayingChange', (e) => {
      if (isVideo(e) && exo()) useVideo.setState({ isPlaying: e.isPlaying });
    }),
    Native.addListener('onBuffering', (e) => {
      if (isVideo(e) && exo()) useVideo.setState({ buffering: e.buffering });
    }),
    Native.addListener('onQueueEnded', (e) => {
      if (isVideo(e) && exo()) onEnded();
    }),
    Native.addListener('onTracks', (info) => {
      if (!exo()) return;
      useVideo.setState({ tracks: info, buffering: false });
      const auto = useMedia.getState().video.engine === 'auto';
      if (auto && (info.videoUnsupported || info.audioUnsupported)) {
        useVideo
          .getState()
          .switchEngine('vlc', info.videoUnsupported ? 'Format vidéo non géré par le téléphone : décodeur logiciel activé' : 'Son non géré par le téléphone : décodeur logiciel activé');
      }
    }),
    Native.addListener('onError', (e) => {
      if (!isVideo(e) || !exo()) return;
      const auto = useMedia.getState().video.engine !== 'exo';
      if (e.fallback && auto) {
        useVideo.setState({ position: e.position ?? useVideo.getState().position });
        useVideo.getState().switchEngine('vlc', 'Décodeur logiciel activé pour lire ce fichier');
      } else {
        useVideo.setState({ error: e.message, isPlaying: false, buffering: false });
      }
    }),
    Native.addListener('onVideoSize', (e) => {
      if (useVideo.getState().engine === e.engine && e.width > 0 && e.height > 0) useVideo.setState({ videoW: e.width, videoH: e.height });
    }),
    Native.addListener('onVlcProgress', (e) => {
      if (vlc()) onPosition(e.position, e.duration);
    }),
    Native.addListener('onVlcState', (e) => {
      if (!vlc()) return;
      if (e.state === 'playing') {
        useVideo.setState({ isPlaying: true, buffering: false });
        // Tracks are known once playback started.
        setTimeout(() => useVideo.getState().refreshTracks(), 600);
      } else if (e.state === 'paused' || e.state === 'stopped') useVideo.setState({ isPlaying: false });
      else if (e.state === 'buffering') useVideo.setState({ buffering: true });
      else if (e.state === 'ready') useVideo.setState({ buffering: false });
      else if (e.state === 'ended') onEnded();
    }),
    Native.addListener('onVlcError', (e) => {
      if (vlc()) useVideo.setState({ error: e.message, isPlaying: false, buffering: false });
    }),
  ];
  return () => subs.forEach((s) => s.remove());
}
