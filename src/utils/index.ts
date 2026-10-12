import type { Track } from '../store/library';

export const UNKNOWN = 'Inconnu';

export function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function formatTotal(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function compareText(a: string, b: string) {
  return collator.compare(a, b);
}

/** A–Z bucket for the fast scroller; anything else (digits, symbols, other scripts) goes to '#'. */
export function indexLetter(text: string): string {
  let s = (text || '').trim();
  try {
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // normalize unavailable: keep the raw text
  }
  const first = s.charAt(0).toUpperCase();
  return first >= 'A' && first <= 'Z' ? first : '#';
}

/** Sort key that puts '#' entries first, then letters alphabetically. */
export function sortByName<T>(items: T[], getName: (t: T) => string, desc = false): T[] {
  const sorted = [...items].sort((a, b) => {
    const na = getName(a);
    const nb = getName(b);
    const la = indexLetter(na);
    const lb = indexLetter(nb);
    if (la === '#' && lb !== '#') return -1;
    if (lb === '#' && la !== '#') return 1;
    return compareText(na, nb);
  });
  return desc ? sorted.reverse() : sorted;
}

export const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export function displayFolder(path: string): string {
  if (!path) return '';
  return path
    .replace(/^\/storage\/emulated\/0/, '/Stockage interne')
    .replace(/^\/sdcard/, '/Stockage interne')
    .replace(/^\/storage\/[0-9A-F]{4}-[0-9A-F]{4}/i, '/Carte SD');
}

export function folderName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function artistOf(t: Pick<Track, 'artist'>) {
  return t.artist || UNKNOWN;
}

export function albumOf(t: Pick<Track, 'album'>) {
  return t.album || UNKNOWN;
}

export function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const NOISE_BRACKETS =
  /[([](?:\s*(?:\d{2,3}\s?kbps|\d{2,3}\s?k|hq|hd|4k|mp3|m4a|audio|lyrics?|paroles|official|officiel|visuali[sz]er|clip|video|vid[ée]o|music|musique|officielle|audio officiel|clip officiel|vid[ée]o officielle|official (?:music )?(?:video|audio)|official lyrics? video|lyrics? video|lyric video)\s*)+[)\]]/gi;
const NOISE_WORDS =
  /\b(?:official\s+(?:music\s+)?(?:video|audio|clip)|official\s+lyrics?\s+video|lyrics?\s+video|clip\s+officiel|audio\s+officiel|vid[ée]o\s+officielle|official\s+visuali[sz]er)\b/gi;

function smartCase(s: string) {
  // Capitalise each word that is all upper or all lower case; keep deliberate casing ("DJ", "McCoy").
  return s
    .split(' ')
    .map((w) => {
      if (w.length < 2 || w === 'feat.') return w;
      const uniform = w === w.toUpperCase() || w === w.toLowerCase();
      return uniform ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
    })
    .join(' ');
}

/**
 * Turns file-name style titles ("Akon_-_Lonely__Official_Music_Video_(128k)") into
 * readable ones and, when the file has no artist tag, takes the artist from "Artist - Title".
 */
export function cleanTrackNames(title: string, artist: string): { title: string; artist: string } {
  let t = (title || '').replace(/_{3,}/g, ' - ').replace(/_/g, ' ');
  t = t.replace(NOISE_BRACKETS, ' ').replace(NOISE_WORDS, ' ');
  t = t.replace(/\s*[([]\s*[)\]]/g, ' ').replace(/\s{2,}/g, ' ').replace(/[\s\-–|]+$/g, '').trim();
  let a = (artist || '').trim();
  if (!a) {
    const m = t.match(/^(.{2,60}?)\s+[-–]\s+(.+)$/);
    if (m) {
      a = smartCase(m[1].replace(/\s+(?:ft|feat)\.?\s+/i, ' feat. ').trim());
      t = m[2].trim();
    }
  }
  return { title: t || title, artist: a };
}
