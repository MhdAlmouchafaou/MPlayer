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
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useHydrated() {
  const [hydrated, setHydrated] = useState(useUserStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useUserStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

function Bootstrap() {
  const hydrated = useHydrated();
  const permission = useLibrary((s) => s.permission);
  const loaded = useLibrary((s) => s.loaded);

  useEffect(() => attachPlayerEvents(), []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const state = await useLibrary.getState().checkPermission();
      if (state === 'granted') await useLibrary.getState().scan();
      SplashScreen.hideAsync().catch(() => {});
      await applyNativeSettings();
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
        useLibrary.getState().checkPermission().then((p) => {
          if (p === 'granted' && Date.now() - last > 30000) {
            last = Date.now();
            useLibrary.getState().scan();
          }
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
                  contentStyle: { backgroundColor: t.bg },
                }}
              />
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
