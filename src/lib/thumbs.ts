import { useEffect, useState } from 'react';
import { Native } from '../../modules/mplayer-core';

type Entry = string | null;
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry>>();

const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiting: (() => void)[] = [];

function slot(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) =>
    waiting.push(() => {
      inFlight++;
      resolve();
    })
  );
}

function release() {
  inFlight--;
  waiting.pop()?.(); // most recent request first: those rows are on screen
}

export function loadVideoThumb(idOrUri: string, width: number): Promise<Entry> {
  const k = `${idOrUri}@${width}`;
  if (cache.has(k)) return Promise.resolve(cache.get(k)!);
  const existing = pending.get(k);
  if (existing) return existing;
  if (!Native) return Promise.resolve(null);
  const p = slot()
    .then(() => Native!.getVideoThumbnail(idOrUri, width))
    .catch(() => null)
    .then((uri) => {
      release();
      cache.set(k, uri ?? null);
      pending.delete(k);
      return uri ?? null;
    });
  pending.set(k, p);
  return p;
}

export function peekVideoThumb(idOrUri: string, width = 320): Entry | undefined {
  return cache.get(`${idOrUri}@${width}`);
}

/** Thumbnail of a video: MediaStore id when available, else the uri. */
export function useVideoThumb(idOrUri: string | undefined, width = 320): Entry {
  const k = idOrUri ? `${idOrUri}@${width}` : '';
  const [uri, setUri] = useState<Entry>(() => (k ? cache.get(k) ?? null : null));
  useEffect(() => {
    if (!idOrUri) return setUri(null);
    if (cache.has(k)) return setUri(cache.get(k)!);
    setUri(null);
    let alive = true;
    loadVideoThumb(idOrUri, width).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [idOrUri, width, k]);
  return uri;
}
