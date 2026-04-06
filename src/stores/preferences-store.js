'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '@/lib/preferences/storage';

export const usePreferencesStore = create(
  persist(
    (set) => ({
      realtimeAlertsEnabled: true,
      devModeEnabled: false,
      useTestSocket: false,

      setRealtimeAlertsEnabled: (enabled) =>
        set({ realtimeAlertsEnabled: Boolean(enabled) }),
      setDevModeEnabled: (enabled) => set({ devModeEnabled: Boolean(enabled) }),
      setUseTestSocket: (enabled) => set({ useTestSocket: Boolean(enabled) }),
    }),
    {
      name: 'redmap-preferences',
      storage: idbJSONStorage,
      skipHydration: true,
    },
  ),
);
