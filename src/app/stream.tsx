import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/ui';
import { playUri } from '../lib/videoActions';
import { toast } from '../store/ui';
import { useTheme } from '../theme';

export default function StreamScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const open = () => {
    const u = url.trim();
    if (!/^(https?|rtsp|rtmp|mms|udp):\/\//i.test(u)) return toast('Adresse invalide (http, https, rtsp, rtmp…)');
    router.back();
    setTimeout(() => playUri(u, u.split('/').pop()?.split('?')[0] || 'Flux réseau'), 150);
  };
  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton name="chevronLeft" size={26} color={t.icon} label="Retour" onPress={() => router.back()} />
        <Text style={[styles.title, { color: t.text }]}>Flux réseau</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.textSecondary, fontSize: 14.5, lineHeight: 20 }}>
          Collez l’adresse d’une vidéo ou d’un direct : MP4, MKV, HLS (.m3u8), DASH, RTSP, RTMP…
        </Text>
        <View style={[styles.field, { backgroundColor: t.chip }]}>
          <Icon name="video" size={20} color={t.textSecondary} />
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://…"
            placeholderTextColor={t.textTertiary}
            onSubmitEditing={open}
            style={[styles.input, { color: t.text }]}
          />
        </View>
        <Pressable onPress={open} style={[styles.btn, { backgroundColor: t.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Lire</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: 22, fontWeight: '600', marginLeft: 4 },
  card: { margin: 12, borderRadius: 26, padding: 20 },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, height: 48, paddingHorizontal: 14, marginTop: 16 },
  input: { flex: 1, fontSize: 16, marginLeft: 10, paddingVertical: 0 },
  btn: { marginTop: 16, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
