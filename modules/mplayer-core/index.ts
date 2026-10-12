import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type React from 'react';
import type { ViewProps } from 'react-native';

export type NativeTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  artistId: string;
  duration: number;
  path: string;
  folder: string;
  fileName: string;
  dateAdded: number;
  size: number;
  mimeType: string;
  trackNumber: number;
  year: number;
  genre: string;
};

export type QueueItem = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  artwork?: string | null;
  kind?: 'audio' | 'video';
};

export type NativeVideo = {
  id: string;
  uri: string;
  title: string;
  fileName: string;
  duration: number;
  width: number;
  height: number;
  size: number;
  dateAdded: number;
  path: string;
  folder: string;
  mimeType: string;
};

export type NativeDoc = {
  id: string;
  uri: string;
  name: string;
  path: string;
  folder: string;
  size: number;
  modified: number;
};

export type TrackOption = {
  id: string;
  label: string;
  language?: string | null;
  selected?: boolean;
  supported?: boolean;
  codec?: string | null;
  channels?: number;
};

export type TracksInfo = {
  audio: TrackOption[];
  text: TrackOption[];
  video: {
    codec: string | null;
    mime: string | null;
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
    hdr: boolean;
    supported: boolean;
  } | null;
  videoUnsupported: boolean;
  audioUnsupported: boolean;
};

export type VaultItem = {
  id: string;
  name: string;
  mime: string;
  kind: 'video' | 'audio' | 'image' | 'pdf' | 'file';
  size: number;
  added: number;
  uri: string;
  exists: boolean;
};

export type PdfInfo = { pageCount: number; pages: { w: number; h: number }[]; key: string };

export type PlayerState = {
  index: number;
  count: number;
  position: number;
  duration: number;
  isPlaying: boolean;
  playWhenReady: boolean;
  id: string;
};

export type EqualizerInfo = {
  available: boolean;
  enabled: boolean;
  minLevel: number;
  maxLevel: number;
  bands: { index: number; centerFreq: number; level: number }[];
  presets: string[];
  bassBoostSupported: boolean;
  bassBoost: number;
  virtualizerSupported: boolean;
  virtualizer: number;
};

export type ArtPalette = {
  dominant: string | null;
  vibrant: string | null;
  muted: string | null;
  darkVibrant: string | null;
  darkMuted: string | null;
  lightVibrant: string | null;
  lightMuted: string | null;
};

type Subscription = { remove(): void };

type Kind = { kind?: 'audio' | 'video' };

export type CoreEvents = {
  onTrackChange: (e: { index: number; id: string; auto: boolean } & Kind) => void;
  onPlayingChange: (e: { isPlaying: boolean } & Kind) => void;
  onProgress: (e: { position: number; duration: number; index: number; buffered?: number } & Kind) => void;
  onQueueEnded: (e: Kind) => void;
  onError: (e: { message: string; index: number; code?: number; codeName?: string; fallback?: boolean; position?: number } & Kind) => void;
  onSleepTimerEnd: () => void;
  onBuffering: (e: { buffering: boolean } & Kind) => void;
  onTracks: (e: TracksInfo) => void;
  onVideoSize: (e: { width: number; height: number; engine: 'exo' | 'vlc' }) => void;
  onVlcState: (e: { state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'ready' | 'ended' }) => void;
  onVlcProgress: (e: { position: number; duration: number }) => void;
  onVlcError: (e: { message: string }) => void;
  onVaultProgress: (e: { done: number; total: number; name: string }) => void;
};

export interface CoreNative {
  queryTracks(minDurationMs: number): Promise<NativeTrack[]>;
  getArtwork(trackId: string, albumId: string, size: number): Promise<string | null>;
  clearArtworkMisses(): Promise<void>;
  getPalette(trackId: string, albumId: string): Promise<ArtPalette | null>;
  getVolume(): Promise<number>;
  setVolume(value: number): Promise<void>;
  shareTrack(uri: string, title: string): Promise<void>;

  setQueue(items: QueueItem[], startIndex: number, startPositionMs: number, playWhenReady: boolean): Promise<PlayerState>;
  replaceQueueKeepingCurrent(items: QueueItem[], currentIndex: number): Promise<PlayerState>;
  insertItems(index: number, items: QueueItem[]): Promise<PlayerState>;
  removeItem(index: number): Promise<PlayerState>;
  moveItem(from: number, to: number): Promise<PlayerState>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  skipTo(index: number, play: boolean): Promise<PlayerState>;
  seekTo(positionMs: number): Promise<void>;
  getState(): Promise<PlayerState>;
  stop(): Promise<void>;

  setRepeatMode(mode: 0 | 1 | 2): Promise<void>;
  setSpeed(speed: number): Promise<void>;
  setSkipSilence(enabled: boolean): Promise<void>;
  setPauseOnNoisy(enabled: boolean): Promise<void>;
  setFade(ms: number): Promise<void>;
  setSleepTimer(ms: number, endOfTrack: boolean): Promise<void>;
  getSleepTimer(): Promise<{ remaining: number; endOfTrack: boolean }>;

  getEqualizer(): Promise<EqualizerInfo>;
  setEqualizerEnabled(enabled: boolean): Promise<void>;
  setBandLevel(band: number, level: number): Promise<void>;
  usePreset(preset: number): Promise<EqualizerInfo>;
  setBassBoost(strength: number): Promise<void>;
  setVirtualizer(strength: number): Promise<void>;

  queryVideos(): Promise<NativeVideo[]>;
  getVideoThumbnail(idOrUri: string, width: number): Promise<string | null>;
  getFrameAt(uri: string, positionMs: number, width: number, exact: boolean): Promise<string | null>;
  releaseFrames(): Promise<void>;
  probe(uri: string): Promise<Record<string, string | null>>;
  describeUri(uri: string): Promise<{ name: string; size: number; mimeType?: string | null; path?: string }>;
  persistUri(uri: string): Promise<boolean>;
  queryDocuments(): Promise<NativeDoc[]>;
  hasAllFilesAccess(): Promise<boolean>;
  requestAllFilesAccess(): Promise<void>;
  shareFile(uri: string, mime: string, title: string): Promise<void>;

  setSeekMode(exact: boolean): Promise<void>;
  stepFrame(forward: boolean): Promise<number>;
  selectTrack(type: 'audio' | 'text', id: string | null): Promise<void>;
  getTracks(): Promise<TracksInfo>;
  setVolumeBoost(mb: number): Promise<void>;
  captureFrame(name: string): Promise<string | null>;

  vlcOpen(uri: string, startMs: number, play: boolean): Promise<void>;
  vlcPlay(): Promise<void>;
  vlcPause(): Promise<void>;
  vlcSeek(ms: number, fast: boolean): Promise<void>;
  vlcSetRate(rate: number): Promise<void>;
  vlcTracks(): Promise<{ audio: TrackOption[]; text: TrackOption[]; audioSelected: string; textSelected: string }>;
  vlcSelectAudio(id: number): Promise<void>;
  vlcSelectText(id: number): Promise<void>;
  vlcStop(): Promise<void>;
  vlcState(): Promise<{ position: number; duration: number; isPlaying: boolean }>;

  setBrightness(value: number): Promise<void>;
  getBrightness(): Promise<number>;
  setKeepAwake(on: boolean): Promise<void>;
  setImmersive(on: boolean): Promise<void>;
  setOrientation(mode: 'landscape' | 'portrait' | 'sensor' | 'locked' | 'auto'): Promise<void>;
  enterPip(width: number, height: number): Promise<boolean>;
  setAutoPip(enabled: boolean, width: number, height: number): Promise<void>;
  isInPip(): Promise<boolean>;
  getSystemVolume(): Promise<{ current: number; max: number }>;
  setSystemVolumeStep(step: number): Promise<void>;

  vaultStatus(): Promise<{ hasPin: boolean; length: number; failCount: number; lockedForMs: number }>;
  vaultSetPin(pin: string): Promise<boolean>;
  vaultVerify(pin: string): Promise<{ ok: boolean; lockedForMs: number; failCount: number }>;
  vaultList(): Promise<VaultItem[]>;
  vaultImport(uris: string[], removeOriginal: boolean): Promise<{ ok: boolean; name: string; removed: boolean; id?: string; error?: string }[]>;
  vaultRestore(id: string): Promise<string | null>;
  vaultDelete(ids: string[]): Promise<number>;
  vaultRename(id: string, name: string): Promise<boolean>;
  vaultUsage(): Promise<number>;
  setSecure(on: boolean): Promise<void>;
  openWithSystem(uri: string, mime: string): Promise<boolean>;
  openDefaultAppsSettings(): Promise<boolean>;

  pdfOpen(uri: string): Promise<PdfInfo>;
  pdfRender(uri: string, page: number, width: number, mode: number): Promise<string | null>;
  pdfClose(uri: string): Promise<void>;
  pdfThumbnail(uri: string, width: number): Promise<string | null>;
  pdfClearCache(): Promise<void>;

  addListener<K extends keyof CoreEvents>(event: K, listener: CoreEvents[K]): Subscription;
}

/** Null when running without the native build (web preview, Expo Go). */
export const Native = requireOptionalNativeModule<CoreNative>('MPlayerCore');

export type VideoSurfaceProps = ViewProps & {
  engine: 'exo' | 'vlc' | 'none';
  resizeMode?: 'fit' | 'fill' | 'stretch' | '16:9' | '4:3';
  subtitleScale?: number;
  subtitleStyle?: 'shadow' | 'box' | 'yellow';
};

let surface: React.ComponentType<VideoSurfaceProps> | null = null;
/** Native video surface. Resolved lazily so the JS bundle still loads without the native build. */
export function getVideoSurface(): React.ComponentType<VideoSurfaceProps> | null {
  if (surface || !Native) return surface;
  try {
    surface = requireNativeView<VideoSurfaceProps>('MPlayerCore');
  } catch {
    surface = null;
  }
  return surface;
}
