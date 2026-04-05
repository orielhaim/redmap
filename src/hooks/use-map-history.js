'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getHistory } from '@/lib/api/redalert';

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

export function useMapHistory(filters, cityCache) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cityCacheRef = useRef(cityCache);
  useEffect(() => { cityCacheRef.current = cityCache; }, [cityCache]);

  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    cancelRef.current = false;
    setLoading(true);
    setError(null);
    setEvents([]);

    try {
      let allData = [];
      let offset = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        if (cancelRef.current) return;

        const res = await getHistory({
          startDate: filters.startDate,
          endDate: filters.endDate,
          origin: filters.origin || undefined,
          limit: PAGE_SIZE,
          offset,
          sort: 'timestamp',
          order: 'asc',
        });

        const rows = res.data ?? [];
        allData = allData.concat(rows);
        offset += PAGE_SIZE;

        if (rows.length < PAGE_SIZE || !res.pagination?.hasMore) break;
      }

      if (cancelRef.current) return;

      allData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const cache = cityCacheRef.current;
      const enriched = allData.map((ev) => ({
        ...ev,
        cities: (ev.cities ?? []).map((c) => {
          const cached = cache?.get(String(c.id)) ?? cache?.get(c.name) ?? null;
          return cached ? { ...cached, ...c } : c;
        }),
      }));

      if (cancelRef.current) return;
      setEvents(enriched);
    } catch (err) {
      if (!cancelRef.current) setError(err?.message ?? 'Failed to load history');
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.origin]);

  useEffect(() => {
    if (!cityCache) return;
    load();
    return () => { cancelRef.current = true; };
  }, [load, cityCache]);

  return { events, loading, error, refetch: load };
}
