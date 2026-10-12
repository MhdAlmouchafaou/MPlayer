import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/SettingItem';
import { Card, IconButton, SectionLabel, Switch } from '../components/ui';
import { toast } from '../store/ui';
import { DEFAULT_TABS, TAB_LABELS, useUserStore } from '../store/user';
import { useTheme } from '../theme';

export default function TabsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = useUserStore((s) => s.settings.tabs);
  const update = useUserStore((s) => s.updateSettings);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tabs.length) return;
    const next = [...tabs];
    [next[i], next[j]] = [next[j], next[i]];
    update({ tabs: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Gérer les onglets" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <SectionLabel>Onglets affichés et ordre</SectionLabel>
        <Card>
          {tabs.map((tab, i) => (
            <View key={tab.key} style={[styles.row, i < tabs.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.divider }]}>
              <Switch
                value={tab.visible}
                onChange={(v) => {
                  if (!v && tabs.filter((x) => x.visible).length <= 1) return toast('Gardez au moins un onglet');
                  update({ tabs: tabs.map((x) => (x.key === tab.key ? { ...x, visible: v } : x)) });
                }}
              />
              <Text style={[styles.label, { color: tab.visible ? t.text : t.textTertiary }]}>{TAB_LABELS[tab.key]}</Text>
              <IconButton name="chevronUp" size={22} color={t.icon} disabled={i === 0} label="Monter" onPress={() => move(i, -1)} />
              <IconButton
                name="chevronDown"
                size={22}
                color={t.icon}
                disabled={i === tabs.length - 1}
                label="Descendre"
                onPress={() => move(i, 1)}
              />
            </View>
          ))}
        </Card>
        <Text
          onPress={() => update({ tabs: DEFAULT_TABS })}
          style={{ color: t.accent, fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 24 }}
        >
          Rétablir l'ordre par défaut
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
    paddingRight: 8,
  },
  label: {
    flex: 1,
    fontSize: 17.5,
    marginLeft: 18,
  },
});
