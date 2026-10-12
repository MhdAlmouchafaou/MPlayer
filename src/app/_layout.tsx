import { Outfit_500Medium, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Overlays } from '../components/Overlays';
import { PlayerSheet } from '../components/player/PlayerSheet';
import { useLibrary } from '../store/library';
import { applyNativeSettings, attachPlayerEvents, restoreSession } from '../store/player';
import { useUserStore } from '../store/user';
import { VideoMini } from '../components/video/VideoMini';
import { requestMedia } from '../lib/permissions';
import { useDocs } from '../store/docs';
import { useMedia } from '../store/media';
import { attachVideoEvents } from '../store/video';
import { useVideos } from '../store/videos';
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useHydrated() {
  const both = () => useUserStore.persist.hasHydrated() && useMedia.persist.hasHydrated();
  const [hydrated, setHydrated] = useState(both());
  useEffect(() => {
    const a = useUserStore.persist.onFinishHydration(() => setHydrated(both()));
    const b = useMedia.persist.onFinishHydration(() => setHydrated(both()));
    setHydrated(both());
    return () => {
      a();
      b();
    };
  }, []);
  return hydrated;
}

function Bootstrap() {
  const hydrated = useHydrated();
  const permission = useLibrary((s) => s.permission);
  const loaded = useLibrary((s) => s.loaded);

  useEffect(() => attachPlayerEvents(), []);
  useEffect(() => attachVideoEvents(), []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const [audio, video] = await Promise.all([useLibrary.getState().checkPermission(), useVideos.getState().checkPermission()]);
      // First launch: ask once for everything.
      if (audio !== 'granted' && video !== 'granted' && !useUserStore.getState().onboarded) {
        SplashScreen.hideAsync().catch(() => {});
        useUserStore.getState().setOnboarded();
        await requestMedia().catch(() => null);
        await Promise.all([useLibrary.getState().checkPermission(), useVideos.getState().checkPermission()]);
      }
      const jobs: Promise<void>[] = [];
      if (useVideos.getState().permission === 'granted') jobs.push(useVideos.getState().scan());
      if (useLibrary.getState().permission === 'granted') jobs.push(useLibrary.getState().scan());
      await Promise.all(jobs);
      SplashScreen.hideAsync().catch(() => {});
      await applyNativeSettings();
      if (useMedia.getState().section === 'docs') useDocs.getState().scan();
    })();
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && permission === 'granted' && loaded) restoreSession().catch(() => {});
  }, [hydrated, permission, loaded]);

  // Pick up files added while the app was in the background.
  useEffect(() => {
    let last = Date.now();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        Promise.all([useLibrary.getState().checkPermission(), useVideos.getState().checkPermission()]).then(([a, v]) => {
          if (Date.now() - last < 30000) return;
          last = Date.now();
          if (a === 'granted') useLibrary.getState().scan();
          if (v === 'granted') useVideos.getState().scan();
        });
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({ Outfit_700Bold, Outfit_500Medium });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: t.bg }]}>
          <StatusBar style={t.dark ? 'light' : 'dark'} />
          <Bootstrap />
          {fontsLoaded ? (
            <>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 260,
                  freezeOnBlur: true,
                  contentStyle: { backgroundColor: t.bg },
                }}
              >
                <Stack.Screen name="video" options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: '#000' } }} />
                <Stack.Screen name="open" options={{ animation: 'none', contentStyle: { backgroundColor: '#000' } }} />
                <Stack.Screen name="pdf" options={{ animation: 'slide_from_bottom' }} />
              </Stack>
              <VideoMini />
              <PlayerSheet />
              <Overlays />
            </>
          ) : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
