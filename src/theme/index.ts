import { useColorScheme } from 'react-native';
import { useUserStore } from '../store/user';

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  brand: string;
  tabActive: string;
  tabInactive: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  divider: string;
  placeholder: string;
  placeholderIcon: string;
  accent: string;
  accentSoft: string;
  accentTrack: string;
  chip: string;
  menu: string;
  scrim: string;
  danger: string;
  icon: string;
  navBar: string;
  navPill: string;
  navActive: string;
};

export const light: Theme = {
  dark: false,
  bg: '#EEF0F4',
  surface: '#F9FAFC',
  surfaceAlt: '#FFFFFF',
  brand: '#11457D',
  tabActive: '#11457D',
  tabInactive: '#7C8BA3',
  text: '#121316',
  textSecondary: '#787B82',
  textTertiary: '#9EA2AA',
  divider: '#E3E5EA',
  placeholder: '#E2E2E5',
  placeholderIcon: '#FFFFFF',
  accent: '#2E66C9',
  accentSoft: '#7EABEC',
  accentTrack: '#D7E5FA',
  chip: '#E6E7EB',
  menu: '#FBFBFD',
  scrim: 'rgba(10,12,18,0.32)',
  danger: '#D93B3B',
  icon: '#3A3D44',
  navBar: '#FFFFFF',
  navPill: '#EDF0F6',
  navActive: '#2F55E4',
};

export const dark: Theme = {
  dark: true,
  bg: '#0B0C0F',
  surface: '#17181C',
  surfaceAlt: '#1E1F24',
  brand: '#8FB2FF',
  tabActive: '#A9C3FF',
  tabInactive: '#6B7386',
  text: '#F1F2F5',
  textSecondary: '#9A9DA6',
  textTertiary: '#6F727B',
  divider: '#2A2C32',
  placeholder: '#2A2B31',
  placeholderIcon: '#5A5C64',
  accent: '#7EA6F5',
  accentSoft: '#5D86D6',
  accentTrack: '#26334D',
  chip: '#26272D',
  menu: '#23242A',
  scrim: 'rgba(0,0,0,0.55)',
  danger: '#FF6B6B',
  icon: '#D4D6DC',
  navBar: '#1F2026',
  navPill: '#2E3039',
  navActive: '#8FB2FF',
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useUserStore((s) => s.settings.theme);
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return isDark ? dark : light;
}

export const fonts = {
  brand: 'Outfit_700Bold',
  brandMedium: 'Outfit_500Medium',
};

/** Two soft colours derived from a seed, used for the player backdrop and mini player. */
export function paletteFor(seed: string | undefined) {
  let hash = 0;
  const s = seed ?? '';
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  const hues = [262, 214, 330, 190, 24, 150, 286, 200];
  const base = s ? hues[Math.abs(hash) % hues.length] : 262;
  const second = (base + 120 + (Math.abs(hash >> 3) % 50)) % 360;
  return {
    primary: `hsl(${base}, 26%, 56%)`,
    secondary: `hsl(${second}, 26%, 66%)`,
    mini: `hsl(${base}, 25%, 50%)`,
    miniDark: `hsl(${base}, 22%, 32%)`,
    deep: `hsl(${base}, 30%, 22%)`,
  };
}
