import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Native, type VaultItem } from '../../modules/mplayer-core';
import { Icon, type IconName } from '../components/Icon';
import { haptic, IconButton } from '../components/ui';
import { PinPad } from '../components/vault/PinPad';
import { useVideoThumb } from '../lib/thumbs';
import { openVaultItem, pickIntoVault } from '../lib/vaultActions';
import { toast, useUI } from '../store/ui';
import { useVault } from '../store/vault';
import { useTheme } from '../theme';
import { formatSize, plural } from '../utils';

type Status = { hasPin: boolean; length: number; failCount: number; lockedForMs: number };

function Shield({ size = 72 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.shield, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.accent }]}>
      <Icon name="lock" size={size * 0.46} color="#fff" strokeWidth={2} />
    </View>
  );
}

// ---------- Setup ----------
function Setup({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [step, setStep] = useState<'intro' | 'enter' | 'confirm'>('intro');
  const [length, setLength] = useState<4 | 6>(4);
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState(0);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (value.length !== length) return;
    if (step === 'enter') {
      setFirst(value);
      setTimeout(() => {
        setValue('');
        setStep('confirm');
      }, 150);
    } else if (step === 'confirm') {
      if (value !== first) {
        setError((e) => e + 1);
        setTimeout(() => setValue(''), 300);
        toast('Les codes ne correspondent pas');
        return;
      }
      Native?.vaultSetPin(value).then((ok) => {
        if (!ok) return toast('Impossible d’enregistrer le code');
        toast('Dossier privé prêt');
        onDone();
      });
    }
  }, [value, length, step, first, onDone]);

  if (step === 'intro') {
    return (
      <ScrollView contentContainerStyle={styles.intro}>
        <Shield />
        <Text style={[styles.h1, { color: t.text }]}>Dossier privé</Text>
        <Text style={[styles.p, { color: t.textSecondary }]}>
          Mettez à l’abri vos vidéos, photos, audios et documents. Ils disparaissent de la galerie et des autres applications et ne
          s’ouvrent qu’avec votre code.
        </Text>
        <View style={[styles.lengthRow, { backgroundColor: t.chip }]}>
          {([4, 6] as const).map((n) => (
            <Pressable key={n} onPress={() => setLength(n)} style={[styles.lengthBtn, length === n && { backgroundColor: t.surfaceAlt }]}>
              <Text style={{ color: length === n ? t.accent : t.textSecondary, fontWeight: '700', fontSize: 15 }}>{n} chiffres</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.warning, { backgroundColor: t.dark ? '#3A2616' : '#FFF1E2' }]}>
          <Icon name="info" size={22} color="#E8822A" />
          <Text style={[styles.warningText, { color: t.text }]}>
            Aucun moyen de réinitialiser le code n’existe. Si vous l’oubliez, le contenu du dossier privé sera définitivement
            inaccessible. Désinstaller MPlayer ou effacer ses données supprime aussi ce contenu.
          </Text>
        </View>
        <Pressable onPress={() => setAccepted((a) => !a)} style={styles.accept}>
          <View style={[styles.checkbox, { borderColor: accepted ? t.accent : t.textTertiary, backgroundColor: accepted ? t.accent : 'transparent' }]}>
            {accepted ? <Icon name="check" size={16} color="#fff" strokeWidth={2.6} /> : null}
          </View>
          <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>J’ai compris que mon code ne pourra pas être récupéré</Text>
        </Pressable>
        <Pressable
          disabled={!accepted}
          onPress={() => setStep('enter')}
          style={[styles.primary, { backgroundColor: t.accent, opacity: accepted ? 1 : 0.4 }]}
        >
          <Text style={styles.primaryText}>Créer mon code</Text>
        </Pressable>
      </ScrollView>
    );
  }
  return (
    <Animated.View key={step} entering={FadeInDown.duration(220)} style={styles.padScreen}>
      <Text style={[styles.h2, { color: t.text }]}>{step === 'enter' ? `Choisissez un code à ${length} chiffres` : 'Confirmez votre code'}</Text>
      <Text style={[styles.p, { color: t.textSecondary, marginBottom: 30 }]}>
        {step === 'enter' ? 'Il vous sera demandé à chaque ouverture.' : 'Saisissez-le une seconde fois.'}
      </Text>
      <PinPad length={length} value={value} onChange={setValue} error={error} />
    </Animated.View>
  );
}

// ---------- Unlock ----------
function Unlock({ status, onUnlocked }: { status: Status; onUnlocked: () => void }) {
  const t = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState(0);
  const [checking, setChecking] = useState(false);
  const [lockedFor, setLockedFor] = useState(status.lockedForMs);
  const [fails, setFails] = useState(status.failCount);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setInterval(() => setLockedFor((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(timer);
  }, [lockedFor > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value.length !== status.length || checking || !Native) return;
    setChecking(true);
    Native.vaultVerify(value)
      .then((r) => {
        if (r.ok) {
          haptic();
          onUnlocked();
        } else {
          setError((e) => e + 1);
          setFails(r.failCount);
          if (r.lockedForMs > 0) setLockedFor(r.lockedForMs);
          setTimeout(() => setValue(''), 280);
        }
      })
      .finally(() => setChecking(false));
  }, [value, status.length, checking, onUnlocked]);

  const locked = lockedFor > 0;
  return (
    <View style={styles.padScreen}>
      <Shield size={60} />
      <Text style={[styles.h2, { color: t.text, marginTop: 20 }]}>Saisissez votre code</Text>
      <Text style={[styles.p, { color: locked ? t.danger : fails ? t.danger : t.textSecondary, marginBottom: 30 }]}>
        {locked
          ? `Trop d’essais. Réessayez dans ${Math.ceil(lockedFor / 1000)} s`
          : fails
            ? `Code incorrect · ${plural(fails, 'essai manqué', 'essais manqués')}`
            : 'Le dossier privé est verrouillé'}
      </Text>
      {checking ? <ActivityIndicator color={t.accent} style={{ position: 'absolute', top: 10, right: 10 }} /> : null}
      <PinPad length={status.length} value={value} onChange={setValue} error={error} disabled={locked || checking} />
    </View>
  );
}

// ---------- Content ----------
const FILTERS: { key: 'all' | VaultItem['kind']; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Tout', icon: 'grid' },
  { key: 'video', label: 'Vidéos', icon: 'video' },
  { key: 'image', label: 'Photos', icon: 'camera' },
  { key: 'audio', label: 'Audio', icon: 'note' },
  { key: 'pdf', label: 'Documents', icon: 'doc' },
];

const Tile = memo(function Tile({
  item,
  size,
  selected,
  selecting,
  onPress,
  onLongPress,
}: {
  item: VaultItem;
  size: number;
  selected: boolean;
  selecting: boolean;
  onPress: (i: VaultItem) => void;
  onLongPress: (i: VaultItem) => void;
}) {
  const t = useTheme();
  const thumb = useVideoThumb(item.kind === 'video' ? item.uri : undefined, 320);
  const icon: IconName = item.kind === 'audio' ? 'note' : item.kind === 'pdf' ? 'doc' : item.kind === 'video' ? 'film' : 'page';
  return (
    <Pressable onPress={() => onPress(item)} onLongPress={() => onLongPress(item)} style={{ width: size, padding: 3 }}>
      <View style={[styles.tile, { height: size - 6, backgroundColor: t.dark ? '#24262C' : '#E4E7EE' }]}>
        {item.kind === 'image' ? (
          <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.id} transition={100} />
        ) : item.kind === 'video' && thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.id} />
        ) : (
          <View style={styles.tileIcon}>
            <Icon name={icon} size={30} color={t.textSecondary} />
            <Text numberOfLines={2} style={[styles.tileName, { color: t.text }]}>
              {item.name}
            </Text>
          </View>
        )}
        {item.kind === 'video' ? (
          <View style={styles.tileBadge}>
            <Icon name="play" size={12} color="#fff" />
          </View>
        ) : null}
        {selecting ? (
          <View style={[styles.select, { borderColor: '#fff', backgroundColor: selected ? t.accent : 'rgba(0,0,0,0.25)' }]}>
            {selected ? <Icon name="check" size={14} color="#fff" strokeWidth={2.6} /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

function Content() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const items = useVault((s) => s.items);
  const loading = useVault((s) => s.loading);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const selecting = selected.size > 0;

  useEffect(() => {
    Native?.vaultUsage().then(setUsage).catch(() => {});
  }, [items]);
  useEffect(() => {
    if (!Native) return;
    const sub = Native.addListener('onVaultProgress', (e) => setProgress(e.done >= e.total ? null : e));
    return () => sub.remove();
  }, []);

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kind === filter)), [items, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);
  const cols = width > 700 ? 5 : 3;
  const size = (width - 20) / cols;

  const toggle = useCallback((i: VaultItem) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i.id)) n.delete(i.id);
      else n.add(i.id);
      return n;
    });
  }, []);
  const onPress = useCallback(
    (i: VaultItem) => (selecting ? toggle(i) : openVaultItem(i, useVault.getState().items)),
    [selecting, toggle]
  );
  const onLongPress = useCallback(
    (i: VaultItem) => {
      haptic();
      toggle(i);
    },
    [toggle]
  );

  const restore = () => {
    const ids = [...selected];
    useUI.getState().showConfirm({
      title: `Restaurer ${plural(ids.length, 'élément', 'éléments')} ?`,
      message: 'Les fichiers retourneront dans Films, Musique, Images ou Documents › MPlayer et redeviendront visibles.',
      confirmLabel: 'Restaurer',
      onConfirm: async () => {
        let ok = 0;
        for (const id of ids) if (await Native?.vaultRestore(id)) ok++;
        setSelected(new Set());
        await useVault.getState().refresh();
        toast(`${plural(ok, 'élément restauré', 'éléments restaurés')}`);
      },
    });
  };
  const remove = () => {
    const ids = [...selected];
    useUI.getState().showConfirm({
      title: `Supprimer définitivement ${plural(ids.length, 'élément', 'éléments')} ?`,
      message: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: async () => {
        await Native?.vaultDelete(ids);
        setSelected(new Set());
        await useVault.getState().refresh();
        toast('Supprimé');
      },
    });
  };
  const rename = () => {
    const id = [...selected][0];
    const item = items.find((i) => i.id === id);
    if (!item) return;
    useUI.getState().showPrompt({
      title: 'Renommer',
      initial: item.name,
      confirmLabel: 'Renommer',
      onSubmit: async (name) => {
        await Native?.vaultRename(id, name);
        setSelected(new Set());
        useVault.getState().refresh();
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.chips}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, { backgroundColor: active ? t.accent : t.surface }]}>
                <Icon name={f.icon} size={16} color={active ? '#fff' : t.textSecondary} />
                <Text style={{ color: active ? '#fff' : t.text, fontSize: 14, fontWeight: '600' }}>
                  {f.label}
                  {counts[f.key] ? ` ${counts[f.key]}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {progress ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.progress, { backgroundColor: t.accentTrack }]}>
          <ActivityIndicator color={t.accent} />
          <Text numberOfLines={1} style={{ color: t.text, flex: 1, marginLeft: 10 }}>
            Protection {progress.done + 1}/{progress.total} · {progress.name}
          </Text>
        </Animated.View>
      ) : null}
      {loading && !items.length ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 60 }} />
      ) : shown.length ? (
        <FlashList
          data={shown}
          numColumns={cols}
          keyExtractor={(i) => i.id}
          extraData={selected}
          contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: insets.bottom + 120 }}
          renderItem={({ item }) => (
            <Tile item={item} size={size} selected={selected.has(item.id)} selecting={selecting} onPress={onPress} onLongPress={onLongPress} />
          )}
          ListFooterComponent={
            <Text style={{ color: t.textTertiary, textAlign: 'center', marginTop: 18, fontSize: 13 }}>
              {plural(items.length, 'élément', 'éléments')} · {formatSize(usage)} · stockés dans l’espace privé de l’application
            </Text>
          }
        />
      ) : (
        <View style={styles.empty}>
          <Icon name="lock" size={44} color={t.textTertiary} />
          <Text style={[styles.h2, { color: t.text, marginTop: 14 }]}>Rien ici pour le moment</Text>
          <Text style={[styles.p, { color: t.textSecondary }]}>
            Touchez + pour ajouter des fichiers, ou utilisez « Déplacer dans le dossier privé » depuis le menu d’une vidéo, d’une musique ou
            d’un document.
          </Text>
        </View>
      )}

      {selecting ? (
        <Animated.View entering={FadeInDown.duration(180)} style={[styles.actionBar, { bottom: insets.bottom + 16, backgroundColor: t.navBar }]}>
          <ActionBtn icon="close" label="Annuler" onPress={() => setSelected(new Set())} />
          {selected.size === 1 ? <ActionBtn icon="edit" label="Renommer" onPress={rename} /> : null}
          <ActionBtn icon="share" label="Partager" onPress={() => { const it = items.find((i) => selected.has(i.id)); if (it) Native?.shareFile(it.uri, it.mime, it.name); }} />
          <ActionBtn icon="fileOpen" label="Restaurer" onPress={restore} />
          <ActionBtn icon="trash" label="Supprimer" onPress={remove} danger />
        </Animated.View>
      ) : (
        <Pressable onPress={pickIntoVault} style={[styles.fab, { bottom: insets.bottom + 24, backgroundColor: t.accent }]} accessibilityLabel="Ajouter">
          <Icon name="plus" size={28} color="#fff" strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
}

function ActionBtn({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      <Icon name={icon} size={22} color={danger ? t.danger : t.text} />
      <Text style={{ fontSize: 11.5, marginTop: 3, color: danger ? t.danger : t.textSecondary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function VaultScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const unlocked = useVault((s) => s.unlocked);
  const [status, setStatus] = useState<Status | null>(null);

  const load = useCallback(() => {
    Native?.vaultStatus().then(setStatus);
  }, []);
  useEffect(load, [load]);

  // No screenshots, no preview in the recent apps screen.
  useEffect(() => {
    Native?.setSecure(true);
    return () => {
      if (!useVault.getState().openMedia) Native?.setSecure(false);
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton name="chevronLeft" size={26} color={t.icon} label="Retour" onPress={() => router.back()} />
        <Text style={[styles.title, { color: t.text }]}>Dossier privé</Text>
        {unlocked ? (
          <>
            <IconButton name="plus" size={26} color={t.icon} label="Ajouter" onPress={pickIntoVault} />
            <IconButton
              name="lock"
              size={23}
              color={t.icon}
              label="Verrouiller"
              onPress={() => {
                useVault.getState().lock();
                router.back();
              }}
            />
          </>
        ) : null}
      </View>
      {!status ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 80 }} />
      ) : !status.hasPin ? (
        <Setup
          onDone={() => {
            load();
            useVault.getState().unlock();
          }}
        />
      ) : unlocked ? (
        <Content />
      ) : (
        <Unlock status={status} onUnlocked={() => useVault.getState().unlock()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  title: { flex: 1, fontSize: 21, fontWeight: '600', marginLeft: 4 },
  shield: { alignItems: 'center', justifyContent: 'center' },
  intro: { alignItems: 'center', paddingHorizontal: 26, paddingTop: 20, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: '700', marginTop: 18 },
  h2: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  p: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  lengthRow: { flexDirection: 'row', borderRadius: 22, padding: 4, marginTop: 26 },
  lengthBtn: { paddingHorizontal: 22, height: 40, borderRadius: 20, justifyContent: 'center' },
  warning: { flexDirection: 'row', gap: 12, borderRadius: 20, padding: 16, marginTop: 24 },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20 },
  accept: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, alignSelf: 'stretch' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  primary: { marginTop: 26, height: 52, borderRadius: 26, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  padScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  chips: { height: 54, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19 },
  progress: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 16 },
  tile: { borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileIcon: { alignItems: 'center', padding: 8 },
  tileName: { fontSize: 11.5, textAlign: 'center', marginTop: 6 },
  tileBadge: { position: 'absolute', left: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  select: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 80 },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  actionBar: { position: 'absolute', left: 14, right: 14, height: 66, borderRadius: 33, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', elevation: 12 },
  actionBtn: { alignItems: 'center', minWidth: 60 },
});
