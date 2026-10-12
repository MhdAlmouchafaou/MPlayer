import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createPlaylistFlow } from '../lib/actions';
import { useUI } from '../store/ui';
import { useUserStore } from '../store/user';
import { useTheme } from '../theme';
import { plural } from '../utils';
import { Artwork } from './Artwork';
import { Icon, type IconName } from './Icon';
import { toast } from '../store/ui';

function Backdrop({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
    </Animated.View>
  );
}

function SheetFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Backdrop onPress={onClose} />
      <Animated.View
        entering={SlideInDown.duration(240)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 10 }]}
      >
        <View style={[styles.grabber, { backgroundColor: t.divider }]} />
        {children}
      </Animated.View>
    </Modal>
  );
}

function ActionSheet() {
  const t = useTheme();
  const sheet = useUI((s) => s.sheet);
  const hide = useUI((s) => s.hideSheet);
  if (!sheet) return null;
  return (
    <SheetFrame onClose={hide}>
      {sheet.title ? (
        <View style={styles.sheetHeader}>
          {sheet.track ? <Artwork trackId={sheet.track.id} albumId={sheet.track.albumId} size={52} radius={14} /> : null}
          <View style={{ flex: 1, marginLeft: sheet.track ? 14 : 0 }}>
            <Text numberOfLines={1} style={[styles.sheetTitle, { color: t.text }]}>
              {sheet.details ? sheet.track?.title ?? sheet.title : sheet.title}
            </Text>
            {sheet.subtitle ? (
              <Text numberOfLines={1} style={[styles.sheetSubtitle, { color: t.textSecondary }]}>
                {sheet.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <ScrollView style={{ maxHeight: 520 }} bounces={false}>
        {sheet.details?.map((d) => (
          <View key={d.label} style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textSecondary }]}>{d.label}</Text>
            <Text style={[styles.detailValue, { color: t.text }]} selectable>
              {d.value}
            </Text>
          </View>
        ))}
        {sheet.actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              hide();
              setTimeout(a.onPress, 60);
            }}
            android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
            style={styles.action}
          >
            {a.icon ? <Icon name={a.icon as IconName} size={22} color={a.destructive ? t.danger : t.icon} /> : null}
            <Text style={[styles.actionLabel, { color: a.destructive ? t.danger : t.text }]}>{a.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SheetFrame>
  );
}

function PlaylistPicker() {
  const t = useTheme();
  const picker = useUI((s) => s.playlistPicker);
  const close = useUI((s) => s.closePlaylistPicker);
  const playlists = useUserStore((s) => s.playlists);
  const addToPlaylist = useUserStore((s) => s.addToPlaylist);
  if (!picker) return null;
  const ids = picker.trackIds;
  return (
    <SheetFrame onClose={close}>
      <Text style={[styles.pickerTitle, { color: t.text }]}>Ajouter à une liste de lecture</Text>
      <Pressable
        onPress={() => {
          close();
          setTimeout(() => createPlaylistFlow(ids), 80);
        }}
        android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
        style={styles.pickRow}
      >
        <View style={[styles.newIcon, { backgroundColor: t.accentTrack }]}>
          <Icon name="plus" size={24} color={t.accent} strokeWidth={2} />
        </View>
        <Text style={[styles.pickName, { color: t.accent }]}>Nouvelle liste de lecture</Text>
      </Pressable>
      <ScrollView style={{ maxHeight: 420 }}>
        {playlists.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              const added = addToPlaylist(p.id, ids);
              close();
              toast(added ? `${plural(added, 'piste ajoutée', 'pistes ajoutées')} à « ${p.name} »` : 'Déjà dans la liste');
            }}
            android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
            style={styles.pickRow}
          >
            <Artwork trackId={p.trackIds[0]} size={48} radius={13} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text numberOfLines={1} style={[styles.pickName, { color: t.text }]}>
                {p.name}
              </Text>
              <Text style={{ color: t.textSecondary, fontSize: 14 }}>{plural(p.trackIds.length, 'piste', 'pistes')}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SheetFrame>
  );
}

function DialogFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Backdrop onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={styles.dialogWrap} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(220)} style={[styles.dialog, { backgroundColor: t.surface }]}>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DialogButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  destructive,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.dialogButtons}>
      <Pressable onPress={onCancel} style={styles.dialogButton} android_ripple={{ color: 'rgba(0,0,0,0.06)' }}>
        <Text style={[styles.dialogButtonText, { color: t.accent }]}>Annuler</Text>
      </Pressable>
      <View style={{ width: 1, height: 20, backgroundColor: t.divider }} />
      <Pressable onPress={onConfirm} style={styles.dialogButton} android_ripple={{ color: 'rgba(0,0,0,0.06)' }}>
        <Text style={[styles.dialogButtonText, { color: destructive ? t.danger : t.accent }]}>{confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

function PromptDialog() {
  const t = useTheme();
  const prompt = useUI((s) => s.prompt);
  const hide = useUI((s) => s.hidePrompt);
  const [value, setValue] = useState('');
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (prompt) {
      setValue(prompt.initial ?? '');
      setTimeout(() => input.current?.focus(), 250);
    }
  }, [prompt]);
  if (!prompt) return null;
  const submit = () => {
    if (!value.trim()) return;
    hide();
    prompt.onSubmit(value.trim());
  };
  return (
    <DialogFrame onClose={hide}>
      <Text style={[styles.dialogTitle, { color: t.text }]}>{prompt.title}</Text>
      <TextInput
        ref={input}
        value={value}
        onChangeText={setValue}
        placeholder={prompt.placeholder}
        placeholderTextColor={t.textTertiary}
        selectTextOnFocus
        onSubmitEditing={submit}
        style={[styles.input, { color: t.text, borderBottomColor: t.accent }]}
      />
      <DialogButtons onCancel={hide} onConfirm={submit} confirmLabel={prompt.confirmLabel ?? 'OK'} />
    </DialogFrame>
  );
}

function ConfirmDialog() {
  const t = useTheme();
  const confirm = useUI((s) => s.confirm);
  const hide = useUI((s) => s.hideConfirm);
  if (!confirm) return null;
  return (
    <DialogFrame onClose={hide}>
      <Text style={[styles.dialogTitle, { color: t.text }]}>{confirm.title}</Text>
      {confirm.message ? <Text style={[styles.dialogMessage, { color: t.textSecondary }]}>{confirm.message}</Text> : null}
      <DialogButtons
        onCancel={hide}
        onConfirm={() => {
          hide();
          confirm.onConfirm();
        }}
        confirmLabel={confirm.confirmLabel}
        destructive={confirm.destructive}
      />
    </DialogFrame>
  );
}

function Toast() {
  const toastState = useUI((s) => s.toast);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!toastState) return;
    setVisible(toastState);
    const timer = setTimeout(() => setVisible(null), 2200);
    return () => clearTimeout(timer);
  }, [toastState]);
  if (!visible) return null;
  return (
    <Animated.View
      key={visible.id}
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={[styles.toast, { bottom: insets.bottom + 96 }]}
    >
      <Text style={styles.toastText}>{visible.text}</Text>
    </Animated.View>
  );
}

export function Overlays() {
  return (
    <>
      <ActionSheet />
      <PlaylistPicker />
      <PromptDialog />
      <ConfirmDialog />
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 28,
    paddingTop: 8,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sheetSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  action: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  actionLabel: {
    fontSize: 17,
  },
  detailRow: {
    paddingHorizontal: 24,
    paddingVertical: 9,
  },
  detailLabel: {
    fontSize: 13.5,
  },
  detailValue: {
    fontSize: 16.5,
    marginTop: 2,
  },
  pickerTitle: {
    fontSize: 19,
    fontWeight: '600',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 68,
  },
  newIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pickName: {
    fontSize: 17,
  },
  dialogWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  dialog: {
    borderRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  dialogTitle: {
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 12,
  },
  dialogMessage: {
    fontSize: 15.5,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    borderBottomWidth: 2,
    paddingVertical: 8,
    marginBottom: 10,
  },
  dialogButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dialogButton: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(40,42,48,0.94)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    maxWidth: '86%',
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
});
