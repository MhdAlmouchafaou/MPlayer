import type { Track } from '../store/library';
import type { SortKey } from '../store/user';
import { compareText, indexLetter, sortByName } from '../utils';

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Nom',
  dateAdded: "Date d'ajout",
  artist: 'Artiste',
  album: 'Album',
  duration: 'Durée',
  count: 'Lectures',
};

export function sortTracks(tracks: Track[], key: SortKey, desc: boolean, playCounts: Record<string, number> = {}): Track[] {
  switch (key) {
    case 'name':
      return sortByName(tracks, (t) => t.title, desc);
    case 'artist':
      return sortByName(tracks, (t) => `${t.artist || '￿'} ${t.title}`, desc);
    case 'album':
      return sortByName(tracks, (t) => `${t.album || '￿'} ${String(t.trackNumber).padStart(4, '0')} ${t.title}`, desc);
    case 'dateAdded': {
      const s = [...tracks].sort((a, b) => b.dateAdded - a.dateAdded || compareText(a.title, b.title));
      return desc ? s.reverse() : s;
    }
    case 'duration': {
      const s = [...tracks].sort((a, b) => a.duration - b.duration);
      return desc ? s.reverse() : s;
    }
    case 'count': {
      const s = [...tracks].sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0));
      return desc ? s.reverse() : s;
    }
  }
}

/** For name-like sorts, returns the first row index of each letter. */
export function letterIndex<T>(items: T[], getName: (t: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  items.forEach((item, i) => {
    const l = indexLetter(getName(item));
    if (!map.has(l)) map.set(l, i);
  });
  return map;
}
