// hooks/useMapData.ts
import { useEffect, useState } from 'react';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import type { Location } from '@/api/analytics';

/**
 * Stable pseudo-random color per alert (same id → same color across re-renders).
 */
export function colorForAlertId(alertId: string): string {
  let h = 2166136261;
  for (let i = 0; i < alertId.length; i++) {
    h ^= alertId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  return `hsl(${hue} 70% 50%)`;
}

export interface MapPolygon {
  alertId: string;
  locationId: number;
  name: string;
  color: string;
  /** GeoJSON-order coordinates: [lng, lat][] */
  coordinates: [number, number][];
}

export interface MapPoint {
  alertId: string;
  locationId: number;
  name: string;
  color: string;
  lng: number;
  lat: number;
}

interface MapData {
  polygons: MapPolygon[];
  points: MapPoint[];
  loading: boolean;
}

/**
 * Returns true if the polygon has ≥ 3 coordinate pairs and each pair has
 * two finite numbers.
 */
function isValidPolygon(raw: unknown): raw is number[][] {
  if (!Array.isArray(raw) || raw.length < 3) return false;
  return raw.every(
    (p) => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite),
  );
}

/**
 * The DB stores polygons as `[[lat, lng], …]`.
 * GeoJSON requires `[[lng, lat], …]` with the ring explicitly closed.
 */
function toGeoJSONRing(raw: number[][]): [number, number][] {
  const ring = raw.map<[number, number]>(([lat, lng]) => [lng, lat]);
  // Close the ring if it isn't already
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }
  return ring;
}

export function useMapData(selectedAlertIds: string[]): MapData {
  const { getAlertLocations, locations } = useAnalyticsStore();
  const [data, setData] = useState<MapData>({ polygons: [], points: [], loading: false });

  useEffect(() => {
    if (selectedAlertIds.length === 0) {
      setData({ polygons: [], points: [], loading: false });
      return;
    }

    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true }));

    (async () => {
      // 1. Fetch location IDs for every selected alert (cached in the store)
      const alertLocationEntries = await Promise.all(
        selectedAlertIds.map(async (alertId) => ({
          alertId,
          color: colorForAlertId(alertId),
          locationIds: await getAlertLocations(alertId),
        })),
      );
      if (cancelled) return;

      const polygons: MapPolygon[] = [];
      const points: MapPoint[] = [];

      for (const { alertId, color, locationIds } of alertLocationEntries) {
        for (const lid of locationIds) {
          const loc: Location | undefined = locations.find((l) => l.id === lid);
          if (!loc) continue;

          if (isValidPolygon(loc.polygon)) {
            polygons.push({
              alertId,
              locationId: lid,
              name: loc.name ?? '',
              color,
              coordinates: toGeoJSONRing(loc.polygon),
            });
          } else if (
            loc.lat != null && loc.lng != null &&
            Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
          ) {
            points.push({
              alertId,
              locationId: lid,
              name: loc.name ?? '',
              color,
              lng: loc.lng,
              lat: loc.lat,
            });
          }
        }
      }

      if (!cancelled) {
        setData({ polygons, points, loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, [selectedAlertIds, locations, getAlertLocations]);

  return data;
}
