import { create } from 'zustand';
import { Native, type QueueItem } from '../../modules/mplayer-core';
import { peekArtwork } from '../lib/artwork';
import { shuffleArray } from '../utils';
import { tracksFromIds, useLibrary, type Track } from './library';
import { useUserStore } from './user';
import { useVideo } from './video';

export type RepeatMode = 0 | 1 | 2; // off, one, all

type PlayerStore = {
  queue: string[];
  original: string[];
  index: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  sleepEndsAt: number | null;
  sleepEndOfTrack: boolean;

  current: () => Track | undefined;
  playTracks: (tracks: Track[], startIndex?: number, opts?: { shuffle?: boolean }) => Promise<void>;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  skipTo: (index: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (tracks: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  setSleepTimer: (minutes: number | 'end' | null) => void;
};

const toItem = (t: Track): QueueItem => ({
  id: t.id,
  uri: t.uri,
  title: t.title,
  artist: t.artist || 'Inconnu',
  album: t.album,
  albumId: t.albumId,
  artwork: peekArtwork(t.id, 512) ?? null,
});

const idsToItems = (ids: string[]) => tracksFromIds(ids).map(toItem);

let lastSessionSave = 0;
function saveSession(force = false) {
  const now = Date.now();
  if (!force && now - lastSessionSave < 4000) return;
  lastSessionSave = now;
  const s = usePlayer.getState();
  useUserStore.getState().saveSession(
    s.queue.length
      ? {
          queueIds: s.queue,
          originalIds: s.original,
          index: s.index,
          position: s.position,
          shuffle: s.shuffle,
          repeat: s.repeat,
        }
      : null
  );
}

/** Applies an edited queue to the native player without interrupting the current track. */
async function commitQueue(queue: string[], original: string[], currentIndex: number) {
  usePlayer.setState({ queue, original, index: currentIndex });
  if (!Native) return;
  await Native.replaceQueueKeepingCurrent(idsToItems(queue), currentIndex);
  saveSession(true);
}

function dedupeInsert(queue: string[], index: number, ids: string[], at: 'next' | 'end') {
  const noDup = useUserStore.getState().settings.noDuplicates;
  const currentId = queue[index];
  let q = [...queue];
  let insert = ids;
  if (noDup) {
    const incoming = new Set(ids);
    q = q.filter((id, i) => i === index || !incoming.has(id));
    insert = ids.filter((id) => id !== currentId);
  }
  const ci = q.indexOf(currentId);
  if (at === 'next') q.splice(ci + 1, 0, ...insert);
  else q.push(...insert);
  return { queue: q, index: ci };
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  queue: [],
  original: [],
  index: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 0,
  sleepEndsAt: null,
  sleepEndOfTrack: false,

  current: () => {
    const { queue, index } = get();
    const id = queue[index];
    return id ? useLibrary.getState().byId[id] : undefined;
  },

  playTracks: async (tracks, startIndex = 0, opts) => {
    if (!tracks.length) return;
    // Music takes the shared player back from a video.
    const video = useVideo.getState();
    if (video.active) {
      video.saveProgress();
      if (video.engine === 'vlc') Native?.vlcStop();
      useVideo.setState({ active: false, isPlaying: false });
    }
    const settings = useUserStore.getState().settings;
    const start = tracks[Math.max(0, Math.min(startIndex, tracks.length - 1))];
    let list = settings.queueMode === 'single' && !opts?.shuffle ? [start] : tracks;
    if (settings.noDuplicates) {
      const seen = new Set<string>();
      list = list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
    }
    const original = list.map((t) => t.id);
    const shuffle = opts?.shuffle ?? get().shuffle;
    let queue = original;
    let index = Math.max(0, original.indexOf(start.id));
    if (opts?.shuffle) {
      // "Shuffle all": random order, random first track.
      queue = shuffleArray(original);
      index = 0;
    } else if (shuffle) {
      // Shuffle mode on: the tapped track first, then the rest at random.
      queue = [start.id, ...shuffleArray(original.filter((_, i) => i !== index))];
      index = 0;
    }
    const first = useLibrary.getState().byId[queue[index]];
    // Same list already loaded (tapping another row of it): just jump, no reload gap.
    const current = get();
    if (!opts?.shuffle && !shuffle && current.queue.length === queue.length && current.queue.every((id, i) => id === queue[i])) {
      set({ index, position: 0, duration: first?.duration ?? 0, isPlaying: true });
      if (Native) await Native.skipTo(index, true);
      saveSession(true);
      return;
    }
    set({ queue, original, index, shuffle, position: 0, duration: first?.duration ?? 0, isPlaying: true });
    if (Native) {
      await Native.setQueue(idsToItems(queue), index, 0, true);
    }
    saveSession(true);
  },

  togglePlay: () => {
    if (get().isPlaying) get().pause();
    else get().play();
  },
  play: () => {
    set({ isPlaying: true });
    Native?.play();
  },
  pause: () => {
    set({ isPlaying: false });
    Native?.pause();
    saveSession(true);
  },
  next: () => {
    set({ isPlaying: true });
    Native?.next();
  },
  previous: () => {
    set({ isPlaying: true });
    Native?.previous();
  },
  seek: (ms) => {
    set({ position: ms });
    Native?.seekTo(ms);
  },
  skipTo: (index) => {
    if (index < 0 || index >= get().queue.length) return;
    set({ index, position: 0, isPlaying: true });
    Native?.skipTo(index, true);
  },

  toggleShuffle: () => {
    const { shuffle, queue, original, index } = get();
    const currentId = queue[index];
    if (!queue.length) {
      set({ shuffle: !shuffle });
      return;
    }
    if (!shuffle) {
      const rest = queue.filter((_, i) => i !== index);
      set({ shuffle: true });
      commitQueue([currentId, ...shuffleArray(rest)], original, 0);
    } else {
      const base = original.length ? original : queue;
      const ci = Math.max(0, base.indexOf(currentId));
      set({ shuffle: false });
      commitQueue(base, base, ci);
    }
  },

  cycleRepeat: () => {
    // Cycle: off -> all -> one -> off
    const order: RepeatMode[] = [0, 2, 1];
    const mode = order[(order.indexOf(get().repeat) + 1) % 3];
    set({ repeat: mode });
    Native?.setRepeatMode(mode);
    saveSession(true);
  },

  playNext: (tracks) => {
    const { queue, index, original } = get();
    if (!queue.length) return void get().playTracks(tracks, 0);
    const ids = tracks.map((t) => t.id);
    const r = dedupeInsert(queue, index, ids, 'next');
    const o = Array.from(new Set([...original, ...ids]));
    commitQueue(r.queue, o, r.index);
  },

  addToQueue: (tracks) => {
    const { queue, index, original } = get();
    if (!queue.length) return void get().playTracks(tracks, 0);
    const ids = tracks.map((t) => t.id);
    const r = dedupeInsert(queue, index, ids, 'end');
    const o = Array.from(new Set([...original, ...ids]));
    commitQueue(r.queue, o, r.index);
  },

  removeFromQueue: (i) => {
    const { queue, index, original } = get();
    if (i < 0 || i >= queue.length) return;
    const removed = queue[i];
    const q = queue.filter((_, k) => k !== i);
    const oi = original.indexOf(removed);
    const o = oi >= 0 ? original.filter((_, k) => k !== oi) : original;
    if (!q.length) return get().clearQueue();
    let ni = index;
    if (i < index) ni = index - 1;
    else if (i === index) ni = Math.min(index, q.length - 1);
    set({ queue: q, original: o, index: ni });
    Native?.removeItem(i);
    saveSession(true);
  },

  moveInQueue: (from, to) => {
    const { queue, index } = get();
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    const q = [...queue];
    const [moved] = q.splice(from, 1);
    q.splice(to, 0, moved);
    let ni = index;
    if (from === index) ni = to;
    else if (from < index && to >= index) ni = index - 1;
    else if (from > index && to <= index) ni = index + 1;
    set({ queue: q, index: ni, original: get().shuffle ? get().original : q });
    Native?.moveItem(from, to);
    saveSession(true);
  },

  clearQueue: () => {
    set({ queue: [], original: [], index: 0, isPlaying: false, position: 0, duration: 0 });
    Native?.stop();
    saveSession(true);
  },

  setSleepTimer: (minutes) => {
    if (minutes === null) {
      set({ sleepEndsAt: null, sleepEndOfTrack: false });
      Native?.setSleepTimer(0, false);
    } else if (minutes === 'end') {
      set({ sleepEndsAt: null, sleepEndOfTrack: true });
      Native?.setSleepTimer(0, true);
    } else {
      set({ sleepEndsAt: Date.now() + minutes * 60000, sleepEndOfTrack: false });
      Native?.setSleepTimer(minutes * 60000, false);
    }
  },
}));

/** Wires native events to the store. Call once at startup. */
export function attachPlayerEvents() {
  if (!Native) return () => {};
  const subs = [
    Native.addListener('onTrackChange', ({ index, id, kind }) => {
      if (kind === 'video') return;
      const { queue } = usePlayer.getState();
      let i = index;
      if (queue[i] !== id) {
        const found = queue.indexOf(id);
        if (found >= 0) i = found;
      }
      const track = useLibrary.getState().byId[id];
      usePlayer.setState({ index: i, position: 0, duration: track?.duration ?? 0 });
      if (id) useUserStore.getState().recordPlay(id);
      saveSession(true);
    }),
    Native.addListener('onPlayingChange', ({ isPlaying, kind }) => {
      if (kind === 'video') return;
      usePlayer.setState({ isPlaying });
      if (!isPlaying) saveSession(true);
    }),
    Native.addListener('onProgress', ({ position, duration, kind }) => {
      if (kind === 'video') return;
      usePlayer.setState(duration > 0 ? { position, duration } : { position });
      saveSession();
    }),
    Native.addListener('onQueueEnded', ({ kind }) => {
      if (kind === 'video') return;
      usePlayer.setState({ isPlaying: false });
    }),
    Native.addListener('onSleepTimerEnd', () => {
      usePlayer.setState({ sleepEndsAt: null, sleepEndOfTrack: false });
    }),
  ];
  return () => subs.forEach((s) => s.remove());
}

/** Pushes persisted settings to the native player. */
export async function applyNativeSettings() {
  if (!Native) return;
  const s = useUserStore.getState().settings;
  await Promise.all([
    Native.setSpeed(s.speed),
    Native.setSkipSilence(s.skipSilence),
    Native.setPauseOnNoisy(s.pauseOnNoisy),
    Native.setFade(s.fadeSec * 1000),
  ]).catch(() => {});
  const eq = s.equalizer;
  try {
    if (eq.preset >= 0) await Native.usePreset(eq.preset);
    else eq.bands.forEach((level, band) => Native!.setBandLevel(band, level));
    await Native.setBassBoost(eq.bass);
    await Native.setVirtualizer(eq.virtualizer);
    await Native.setEqualizerEnabled(eq.enabled);
  } catch {
    // effects unsupported on this device
  }
}

/** Restores the last queue (paused) once the library is loaded. */
export async function restoreSession() {
  const session = useUserStore.getState().session;
  if (!session || !session.queueIds.length) return;
  const byId = useLibrary.getState().byId;
  const currentId = session.queueIds[session.index];
  const queue = session.queueIds.filter((id) => byId[id]);
  const original = (session.originalIds ?? queue).filter((id) => byId[id]);
  if (!queue.length) return;
  let index = queue.indexOf(currentId);
  const keepPosition = index >= 0;
  if (index < 0) index = Math.min(session.index, queue.length - 1);
  const track = byId[queue[index]];
  usePlayer.setState({
    queue,
    original: original.length ? original : queue,
    index,
    shuffle: session.shuffle,
    repeat: session.repeat,
    position: keepPosition ? session.position : 0,
    duration: track?.duration ?? 0,
  });
  if (Native) {
    const state = await Native.getState().catch(() => null);
    if (state && state.count > 0) {
      // Playback survived in the background service: just resync.
      const liveIndex = queue.indexOf(state.id);
      usePlayer.setState({ isPlaying: state.isPlaying, position: state.position, index: liveIndex >= 0 ? liveIndex : index });
    } else {
      await Native.setQueue(idsToItems(queue), index, keepPosition ? session.position : 0, false);
    }
    await Native.setRepeatMode(session.repeat);
  }
}
