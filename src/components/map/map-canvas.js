'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Map as MapView,
  Source,
  Layer,
  NavigationControl,
} from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colorForStatus, buildGeometryIndex } from '@/lib/map/alert-engine';
import { cn } from '@/lib/utils';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_VIEW = { longitude: 34.9, latitude: 31.5, zoom: 7 };

const RTL_PLUGIN = {
  pluginUrl:
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js',
  lazy: true,
};

const THROTTLE_MS = 80;

function switchLabelsToHebrew(map) {
  const hebrewField = ['coalesce', ['get', 'name:he'], ['get', 'name']];
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    if (!layer.layout?.['text-field']) continue;
    try {
      map.setLayoutProperty(layer.id, 'text-field', hebrewField);
    } catch {
      /* ignore */
    }
  }
}

export default function MapCanvas({ cityCache, snapshot, events, className }) {
  const mapRef = useRef(null);
  const lastPushRef = useRef(0);
  const pendingRef = useRef(null);
  const rafRef = useRef(null);
  const prevFingerprintRef = useRef('');

  const geometryIndex = useMemo(() => {
    if (!events || !cityCache) return cityCache; // fall back to full cache
    return buildGeometryIndex(events, cityCache);
  }, [events, cityCache]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) switchLabelsToHebrew(map);
  }, []);

  const buildGeoJSON = useCallback(
    (snap) => {
      if (!snap || !geometryIndex)
        return { polygonGeoJSON: emptyFC(), points: [] };

      const polys = [];
      const pts = [];

      for (const [name, cs] of snap) {
        if (cs.status === 'none') continue;

        const city =
          geometryIndex.get(name) ??
          geometryIndex.get(String(cs.cityId)) ??
          null;
        if (!city) continue;

        const color = colorForStatus(cs.status);
        const coords = parsePolygon(city.polygon ?? city.polygons);

        if (coords) {
          polys.push({
            type: 'Feature',
            properties: { name, color, status: cs.status },
            geometry: { type: 'Polygon', coordinates: [coords] },
          });
        } else if (city.lat != null && city.lng != null) {
          pts.push({
            type: 'Feature',
            properties: { name, color },
            geometry: {
              type: 'Point',
              coordinates: [Number(city.lng), Number(city.lat)],
            },
          });
        }
      }

      return {
        polygonGeoJSON: { type: 'FeatureCollection', features: polys },
        points: { type: 'FeatureCollection', features: pts },
      };
    },
    [geometryIndex],
  );

  const pushToMap = useCallback((polyFC, pointFC) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const polySrc = map.getSource('alert-polygons');
    if (polySrc) {
      polySrc.setData(polyFC);
    }

    const ptSrc = map.getSource('alert-points');
    if (ptSrc) {
      ptSrc.setData(pointFC);
    }
  }, []);

  const schedulePush = useCallback(
    (polyFC, pointFC) => {
      const now = performance.now();
      const elapsed = now - lastPushRef.current;

      if (elapsed >= THROTTLE_MS) {
        lastPushRef.current = now;
        pushToMap(polyFC, pointFC);
      } else {
        if (pendingRef.current) cancelAnimationFrame(pendingRef.current);
        pendingRef.current = requestAnimationFrame(() => {
          lastPushRef.current = performance.now();
          pushToMap(polyFC, pointFC);
          pendingRef.current = null;
        });
      }
    },
    [pushToMap],
  );

  useEffect(() => {
    const { polygonGeoJSON, points } = buildGeoJSON(snapshot);
    schedulePush(polygonGeoJSON, points);
  }, [snapshot, buildGeoJSON, schedulePush]);

  useEffect(() => {
    if (!snapshot) return;

    const names = [];
    for (const [name, cs] of snapshot) {
      if (cs.status !== 'none') names.push(name);
    }
    names.sort();
    const fingerprint = names.join('|');

    if (!fingerprint || fingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = fingerprint;

    const timer = setTimeout(() => {
      const { polygonGeoJSON, points } = buildGeoJSON(snapshot);
      const map = mapRef.current?.getMap();
      if (!map) return;

      const coords = [];
      for (const f of polygonGeoJSON.features) {
        for (const ring of f.geometry.coordinates) {
          for (const c of ring) coords.push(c);
        }
      }
      for (const f of points.features) {
        coords.push(f.geometry.coordinates);
      }
      if (coords.length === 0) return;

      let minLng = Infinity,
        maxLng = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: 60,
          maxZoom: 14,
          duration: 400,
        },
      );
    }, 200);

    return () => clearTimeout(timer);
  }, [snapshot, buildGeoJSON]);

  useEffect(
    () => () => {
      if (pendingRef.current) cancelAnimationFrame(pendingRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <MapView
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onLoad={handleLoad}
        RTLTextPlugin={RTL_PLUGIN}
        attributionControl={false}
      >
        <NavigationControl position="top-left" />

        {/* Polygon source — always mounted, data pushed imperatively */}
        <Source id="alert-polygons" type="geojson" data={emptyFC()}>
          <Layer
            id="alert-polygons-fill"
            type="fill"
            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 }}
          />
          <Layer
            id="alert-polygons-border"
            type="line"
            paint={{ 'line-color': ['get', 'color'], 'line-width': 2 }}
          />
          <Layer
            id="alert-polygons-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 12,
              'text-anchor': 'center',
              'text-allow-overlap': false,
              'text-max-width': 8,
            }}
            paint={{
              'text-color': '#fff',
              'text-halo-color': 'rgba(0,0,0,0.8)',
              'text-halo-width': 1.5,
            }}
          />
        </Source>

        {/* Point source — for cities without polygons */}
        <Source id="alert-points" type="geojson" data={emptyFC()}>
          <Layer
            id="alert-points-circle"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': ['get', 'color'],
              'circle-stroke-color': 'rgba(255,255,255,0.8)',
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id="alert-points-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-anchor': 'top',
              'text-offset': [0, 0.8],
              'text-allow-overlap': false,
              'text-max-width': 8,
            }}
            paint={{
              'text-color': '#fff',
              'text-halo-color': 'rgba(0,0,0,0.8)',
              'text-halo-width': 1.5,
            }}
          />
        </Source>
      </MapView>
    </div>
  );
}

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

function parsePolygon(raw) {
  if (!raw) return null;

  if (
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    raw.type === 'Polygon'
  ) {
    const ring = raw.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    return closeRing(ring.map(([lng, lat]) => [Number(lng), Number(lat)]));
  }

  if (!Array.isArray(raw) || raw.length < 3) return null;
  if (
    !raw.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        p.every((v) => Number.isFinite(Number(v))),
    )
  ) {
    return null;
  }

  const [a, b] = raw[0].map(Number);
  const alreadyLngLat = a >= 33 && a <= 38 && b >= 27 && b <= 35;

  const ring = alreadyLngLat
    ? raw.map(([lng, lat]) => [Number(lng), Number(lat)])
    : raw.map(([lat, lng]) => [Number(lng), Number(lat)]);

  return closeRing(ring);
}

function closeRing(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}
