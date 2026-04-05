'use client';

import { useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useMapStore } from '@/stores/map-store';

export default function HydrateStores() {
  useEffect(() => {
    useDashboardStore.persist.rehydrate();
    useMapStore.persist.rehydrate();
  }, []);

  return null;
}
