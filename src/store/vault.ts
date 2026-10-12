import { create } from 'zustand';
import { Native, type VaultItem } from '../../modules/mplayer-core';

type VaultState = {
  unlocked: boolean;
  items: VaultItem[];
  loading: boolean;
  /** Set while a vault file is open in the video player, PDF reader or music player. */
  openMedia: boolean;
  unlock: () => void;
  lock: () => void;
  refresh: () => Promise<void>;
};

export const isVaultUri = (uri?: string | null) => !!uri && uri.includes('/files/vault/');

export const useVault = create<VaultState>((set, get) => ({
  unlocked: false,
  items: [],
  loading: false,
  openMedia: false,
  unlock: () => {
    set({ unlocked: true });
    get().refresh();
  },
  lock: () => set({ unlocked: false, items: [], openMedia: false }),
  refresh: async () => {
    if (!Native || !get().unlocked) return;
    set({ loading: true });
    try {
      const items = await Native.vaultList();
      set({ items: items.filter((i) => i.exists) });
    } finally {
      set({ loading: false });
    }
  },
}));
