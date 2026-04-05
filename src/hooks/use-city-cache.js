'use client';

import { useState, useEffect } from 'react';
import { getCityPolygonMap } from '@/lib/map/city-cache';

export function useCityCache() {
  const [cityCache, setCityCache] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load(forceRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const map = await getCityPolygonMap(forceRefresh);
      setCityCache(map);
    } catch (err) {
      setError(err?.message ?? 'Failed to load city data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return { cityCache, loading, error, refresh: () => load(true) };
}
