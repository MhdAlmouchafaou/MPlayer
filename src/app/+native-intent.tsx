// Files and streams opened from other apps arrive as content://, file:// or http(s)://
// URLs. Route them to the /open screen instead of letting the router treat them as paths.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^(content|file):\/\//i.test(path) || /^https?:\/\/.+\.(mp4|mkv|webm|m3u8|mpd|mov|avi|mp3|m4a|pdf)(\?|$)/i.test(path)) {
      return `/open?uri=${encodeURIComponent(path)}`;
    }
    return path;
  } catch {
    return '/';
  }
}
