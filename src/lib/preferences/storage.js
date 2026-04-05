import { get, set, del } from 'idb-keyval';
import { createJSONStorage } from 'zustand/middleware';

const idbStorage = {
  getItem: async (name) => {
    try {
      return (await get(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await set(name, value);
    } catch {}
  },
  removeItem: async (name) => {
    try {
      await del(name);
    } catch {
      /* ignore */
    }
  },
};

export const idbJSONStorage = createJSONStorage(() => idbStorage);
