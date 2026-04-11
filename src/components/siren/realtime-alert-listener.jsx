'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { useMapStore } from '@/stores/map-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { showAlertToast } from './alert-toast';

export default function RealtimeAlertListener() {
  const router = useRouter();
  const realtimeAlertsEnabled = usePreferencesStore(
    (s) => s.realtimeAlertsEnabled,
  );
  const useTestSocket = usePreferencesStore((s) => s.useTestSocket);

  useEffect(() => {
    if (!realtimeAlertsEnabled) return;

    const namespace = useTestSocket ? '/test' : '/';
    const socket = io(`https://api.siren.co.il${namespace}`, {
      auth: { apiKey: process.env.NEXT_PUBLIC_REDALERT_API_KEY ?? '' },
      transports: ['websocket'],
    });

    function handleAlerts(payloads) {
      const list = Array.isArray(payloads) ? payloads : [payloads];

      for (const item of list) {
        if (!item?.type) continue;

        const cities = (item.cities ?? []).map((c) =>
          typeof c === 'string' ? { name: c } : c,
        );

        const ev = {
          ...item,
          type: item.type,
          timestamp: item.timestamp ?? new Date().toISOString(),
          cities,
        };

        const activeIndex = useMapStore.getState().ingestRealtimeEvent(ev);

        showAlertToast(ev, () => {
          useMapStore.getState().openMapForLatestEvent(activeIndex);
          router.push('/map');
        });
      }
    }

    socket.on('alert', handleAlerts);

    return () => {
      socket.off('alert', handleAlerts);
      socket.disconnect();
    };
  }, [realtimeAlertsEnabled, useTestSocket, router]);

  return null;
}
