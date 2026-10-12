import { create } from 'zustand';
import { Native, type NativeDoc } from '../../modules/mplayer-core';

type DocLibrary = {
  docs: NativeDoc[];
  loading: boolean;
  loaded: boolean;
  allFiles: boolean;
  refreshAccess: () => Promise<boolean>;
  scan: () => Promise<void>;
};

export const useDocs = create<DocLibrary>((set, get) => ({
  docs: [],
  loading: false,
  loaded: false,
  allFiles: false,

  refreshAccess: async () => {
    const allFiles = Native ? await Native.hasAllFilesAccess().catch(() => false) : false;
    set({ allFiles });
    return allFiles;
  },

  scan: async () => {
    if (!Native) return set({ loaded: true });
    if (get().loading) return;
    set({ loading: true });
    try {
      await get().refreshAccess();
      const docs = await Native.queryDocuments();
      docs.sort((a, b) => b.modified - a.modified);
      set({ docs, loaded: true });
    } catch (e) {
      console.warn('doc scan failed', e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));
