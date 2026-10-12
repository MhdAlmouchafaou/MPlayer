import { useEffect, useState } from 'react';
import { Native } from '../../modules/mplayer-core';
import type { Track } from '../store/library';

export type PlayerPalette = {
  /** Blob colour bottom-left. */
  a: string;
  /** Blob colour bottom-right. */
  b: string;
  /** Mini player background. */
  mini: string;
};

const cache = new Map<string, PlayerPalette>();

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Fallback palette derived from a seed: same muted purple/teal family as One UI. */
export function seedPalette(seed: string | undefined): PlayerPalette {
  let hash = 0;
  const s = seed ?? '';
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  const hues = [262, 222, 300, 196, 340, 168, 280, 206];
  const h = s ? hues[Math.abs(hash) % hues.length] : 262;
  const h2 = (h + 140 + (Math.abs(hash >> 4) % 40)) % 360;
  return { a: hsl(h, 28, 56), b: hsl(h2, 24, 66), mini: hsl(h, 25, 50) };
}

function fromSwatches(primary: string, secondary: string | null): PlayerPalette {
  const [h, s] = hexToHsl(primary);
  const [h2, s2] = secondary ? hexToHsl(secondary) : [(h + 140) % 360, s];
  const sat = clamp(s, 18, 42);
  return {
    a: hsl(h, sat, 56),
    b: hsl(h2, clamp(s2, 16, 38), 66),
    mini: hsl(h, clamp(s, 18, 36), 46),
  };
}

export function usePlayerPalette(track: Track | undefined): PlayerPalette {
  const id = track?.id;
  const [palette, setPalette] = useState<PlayerPalette>(() => (id && cache.get(id)) || seedPalette(id));
  useEffect(() => {
    if (!track) {
      setPalette(seedPalette(undefined));
      return;
    }
    const cached = cache.get(track.id);
    if (cached) {
      setPalette(cached);
      return;
    }
    const fallback = seedPalette(track.id);
    setPalette(fallback);
    let alive = true;
    Native?.getPalette(track.id, track.albumId)
      .then((p) => {
        const primary = p ? p.vibrant ?? p.dominant ?? p.muted : null;
        const result = primary ? fromSwatches(primary, p?.muted ?? p?.lightVibrant ?? p?.darkMuted ?? null) : fallback;
        cache.set(track.id, result);
        if (alive) setPalette(result);
      })
      .catch(() => cache.set(track.id, fallback));
    return () => {
      alive = false;
    };
  }, [track]);
  return palette;
}
