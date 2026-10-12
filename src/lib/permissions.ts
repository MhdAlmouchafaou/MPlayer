import { PermissionsAndroid, Platform } from 'react-native';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

const api = Platform.OS === 'android' ? Number(Platform.Version) : 0;
const P = PermissionsAndroid.PERMISSIONS;

const audioPerm = api >= 33 ? P.READ_MEDIA_AUDIO : P.READ_EXTERNAL_STORAGE;
const videoPerm = api >= 33 ? P.READ_MEDIA_VIDEO : P.READ_EXTERNAL_STORAGE;

export async function check(kind: 'audio' | 'video'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return PermissionsAndroid.check(kind === 'audio' ? audioPerm : videoPerm);
}

/** Asks for audio, video and notifications in a single system dialog sequence. */
export async function requestMedia(): Promise<{ audio: PermissionState; video: PermissionState }> {
  if (Platform.OS !== 'android') return { audio: 'granted', video: 'granted' };
  const wanted = Array.from(new Set([audioPerm, videoPerm, ...(api >= 33 ? [P.POST_NOTIFICATIONS] : [])]));
  const result = await PermissionsAndroid.requestMultiple(wanted);
  const map = (r: string | undefined): PermissionState =>
    r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
  return { audio: map(result[audioPerm]), video: map(result[videoPerm]) };
}
