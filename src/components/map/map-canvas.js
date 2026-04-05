'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Map as MapView, Source, Layer, Marker, NavigationControl } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colorForStatus } from '@/lib/map/alert-engine';
import { cn } from '@/lib/utils';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_VIEW = { longitude: 34.9, latitude: 31.5, zoom: 7 };

const RTL_PLUGIN = {
  pluginUrl: 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js',
  lazy: true,
};

function switchLabelsToHebrew(map) {
  const hebrewField = ['coalesce', ['get', 'name:he'], ['get', 'name']];
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    if (!layer.layout?.['text-field']) continue;
    try { map.setLayoutProperty(layer.id, 'text-field', hebrewField); } catch { /* ignore */ }
  }
}

function lookupCity(cityCache, name, cityState) {
  if (!cityCache) return null;

  const byName = cityCache.get(name);
  if (byName && hasGeometry(byName)) return byName;

  const id = cityState?.cityId;
  if (id != null) {
    const byId = cityCache.get(String(id));
    if (byId && hasGeometry(byId)) return byId;
  }

  if (byName) return byName;

  const byId2 = id != null ? cityCache.get(String(id)) : null;
  if (byId2) return byId2;

  return null;
}

function hasGeometry(city) {
  return city.polygon || city.polygons || (city.lat != null && city.lng != null);
}

export default function MapCanvas({ cityCache, snapshot, className }) {
  const mapRef = useRef(null);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) switchLabelsToHebrew(map);
  }, []);

  const { polygonGeoJSON, points } = useMemo(() => {
    if (!snapshot || !cityCache) return { polygonGeoJSON: emptyFC(), points: [] };

    const polys = [];
    const pts = [];

    for (const [name, cs] of snapshot) {
      if (cs.status === 'none') continue;

      const city = lookupCity(cityCache, name, cs);
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
        pts.push({ name, color, lat: Number(city.lat), lng: Number(city.lng) });
      }
    }

    return {
      polygonGeoJSON: { type: 'FeatureCollection', features: polys },
      points: pts,
    };
  }, [snapshot, cityCache]);

  const featureFingerprint = useMemo(() => {
    const names = [];
    for (const f of polygonGeoJSON.features) names.push(f.properties.name);
    for (const p of points) names.push(p.name);
    names.sort();
    return names.join('|');
  }, [polygonGeoJSON, points]);

  const prevFingerprintRef = useRef('');

  useEffect(() => {
    if (!featureFingerprint || featureFingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = featureFingerprint;

    const timer = setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const coords = [];
      for (const f of polygonGeoJSON.features) {
        for (const ring of f.geometry.coordinates) {
          for (const c of ring) coords.push(c);
        }
      }
      for (const p of points) coords.push([p.lng, p.lat]);
      if (coords.length === 0) return;

      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: 60,
        maxZoom: 14,
        duration: 400,
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [featureFingerprint, polygonGeoJSON, points]);

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

        {polygonGeoJSON.features.length > 0 && (
          <Source id="alert-polygons" type="geojson" data={polygonGeoJSON}>
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
        )}

        {points.map((pt) => (
          <Marker key={pt.name} longitude={pt.lng} latitude={pt.lat} anchor="center">
            <div
              className="size-3 rounded-full border-2 border-white/80 shadow-lg"
              style={{ backgroundColor: pt.color }}
              title={pt.name}
            />
          </Marker>
        ))}
      </MapView>
    </div>
  );
}

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

function parsePolygon(raw) {
  if (!raw) return null;

  if (typeof raw === 'object' && !Array.isArray(raw) && raw.type === 'Polygon') {
    const ring = raw.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    return closeRing(ring.map(([lng, lat]) => [Number(lng), Number(lat)]));
  }

  if (!Array.isArray(raw) || raw.length < 3) return null;
  if (!raw.every((p) => Array.isArray(p) && p.length >= 2 && p.every((v) => Number.isFinite(Number(v))))) {
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
