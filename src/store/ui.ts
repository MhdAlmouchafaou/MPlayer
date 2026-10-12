import { create } from 'zustand';
import type { Track } from './library';

export type SheetAction = {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
};

type PromptState = {
  title: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
};

type ConfirmState = {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type UIState = {
  bottomInset: number;
  setBottomInset: (v: number) => void;
  playerOpen: boolean;
  setPlayerOpen: (open: boolean) => void;

  sheet: {
    title?: string;
    subtitle?: string;
    track?: Track;
    actions: SheetAction[];
    details?: { label: string; value: string }[];
  } | null;
  showSheet: (sheet: UIState['sheet']) => void;
  hideSheet: () => void;

  playlistPicker: { trackIds: string[] } | null;
  pickPlaylist: (trackIds: string[]) => void;
  closePlaylistPicker: () => void;

  prompt: PromptState | null;
  showPrompt: (p: PromptState) => void;
  hidePrompt: () => void;

  confirm: ConfirmState | null;
  showConfirm: (c: ConfirmState) => void;
  hideConfirm: () => void;

  toast: { id: number; text: string } | null;
  showToast: (text: string) => void;
};

export const useUI = create<UIState>((set) => ({
  bottomInset: 0,
  setBottomInset: (bottomInset) => set({ bottomInset }),
  playerOpen: false,
  setPlayerOpen: (playerOpen) => set({ playerOpen }),

  sheet: null,
  showSheet: (sheet) => set({ sheet }),
  hideSheet: () => set({ sheet: null }),

  playlistPicker: null,
  pickPlaylist: (trackIds) => set({ playlistPicker: { trackIds } }),
  closePlaylistPicker: () => set({ playlistPicker: null }),

  prompt: null,
  showPrompt: (prompt) => set({ prompt }),
  hidePrompt: () => set({ prompt: null }),

  confirm: null,
  showConfirm: (confirm) => set({ confirm }),
  hideConfirm: () => set({ confirm: null }),

  toast: null,
  showToast: (text) => set({ toast: { id: Date.now(), text } }),
}));

export const toast = (text: string) => useUI.getState().showToast(text);
