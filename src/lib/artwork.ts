import { useEffect, useState } from 'react';
import { Native } from '../../modules/mplayer-core';

type Entry = string | null;
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry>>();
const listeners = new Set<() => void>();

// Keep at most a few requests in flight so fast scrolling stays smooth.
const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiting: (() => void)[] = [];

function slot(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(() => { inFlight++; resolve(); }));
}

function release() {
  inFlight--;
  const next = waiting.pop(); // LIFO: most recently requested rows are on screen
  next?.();
}

const key = (id: string, size: number) => `${id}:${size}`;

export function peekArtwork(id: string | undefined, size = 512): Entry | undefined {
  if (!id) return null;
  return cache.get(key(id, size));
}

export function loadArtwork(id: string, albumId: string, size: number): Promise<Entry> {
  const k = key(id, size);
  if (cache.has(k)) return Promise.resolve(cache.get(k)!);
  const existing = pending.get(k);
  if (existing) return existing;
  if (!Native) {
    cache.set(k, null);
    return Promise.resolve(null);
  }
  const p = slot()
    .then(() => Native!.getArtwork(id, albumId, size))
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

export function useArtwork(id: string | undefined, albumId: string | undefined, size = 256): Entry {
  const [uri, setUri] = useState<Entry>(() => (id ? cache.get(key(id, size)) ?? null : null));
  useEffect(() => {
    if (!id) {
      setUri(null);
      return;
    }
    const k = key(id, size);
    if (cache.has(k)) {
      setUri(cache.get(k)!);
      return;
    }
    setUri(null);
    let alive = true;
    loadArtwork(id, albumId ?? '0', size).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [id, albumId, size]);
  return uri;
}

export function clearArtworkCache() {
  cache.clear();
  listeners.forEach((l) => l());
}
