'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Map as MapView, NavigationControl } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStaticCityGeoJSON, statusCode } from '@/lib/map/alert-engine';
import { cn } from '@/lib/utils';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_VIEW = { longitude: 34.9, latitude: 31.5, zoom: 7 };

const POLY_SOURCE = 'city-polygons';
const POINT_SOURCE = 'city-points';

const RTL_PLUGIN = {
  pluginUrl:
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js',
  lazy: true,
};

const FILL_COLOR_EXPR = [
  'match',
  ['number', ['feature-state', 's'], 0],
  1,
  '#ef4444',
  2,
  '#f59e0b',
  3,
  '#22c55e',
  'rgba(0,0,0,0)',
];

const FILL_OPACITY_EXPR = [
  'case',
  ['>', ['number', ['feature-state', 's'], 0], 0],
  0.3,
  0,
];

const LINE_COLOR_EXPR = FILL_COLOR_EXPR;

const LINE_OPACITY_EXPR = [
  'case',
  ['>', ['number', ['feature-state', 's'], 0], 0],
  1,
  0,
];

const LINE_WIDTH_EXPR = [
  'case',
  ['>', ['number', ['feature-state', 's'], 0], 0],
  2,
  0,
];

const LABEL_OPACITY_EXPR = [
  'case',
  ['>', ['number', ['feature-state', 's'], 0], 0],
  1,
  0,
];

const CIRCLE_COLOR_EXPR = FILL_COLOR_EXPR;

const CIRCLE_OPACITY_EXPR = [
  'case',
  ['>', ['number', ['feature-state', 's'], 0], 0],
  1,
  0,
];

const CIRCLE_STROKE_OPACITY_EXPR = CIRCLE_OPACITY_EXPR;

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

export default function MapCanvas({
  cityCache,
  snapshot,
  autoFocus = true,
  className,
}) {
  const mapRef = useRef(null);
  const sourcesReadyRef = useRef(false);
  const prevActiveRef = useRef(new Set());
  const prevFitRef = useRef('');
  const fitTimer = useRef(null);
  const prevAutoFocusRef = useRef(autoFocus);

  const staticGeoJSON = useMemo(() => {
    return buildStaticCityGeoJSON(cityCache);
  }, [cityCache]);

  const setupSources = useCallback(
    (map) => {
      if (map.getSource(POLY_SOURCE)) return;

      map.addSource(POLY_SOURCE, {
        type: 'geojson',
        data: staticGeoJSON.polygons,
        promoteId: 'name',
      });

      map.addSource(POINT_SOURCE, {
        type: 'geojson',
        data: staticGeoJSON.points,
        promoteId: 'name',
      });

      map.addLayer({
        id: 'alert-poly-fill',
        source: POLY_SOURCE,
        type: 'fill',
        paint: {
          'fill-color': FILL_COLOR_EXPR,
          'fill-opacity': FILL_OPACITY_EXPR,
        },
      });

      map.addLayer({
        id: 'alert-poly-border',
        source: POLY_SOURCE,
        type: 'line',
        paint: {
          'line-color': LINE_COLOR_EXPR,
          'line-opacity': LINE_OPACITY_EXPR,
          'line-width': LINE_WIDTH_EXPR,
        },
      });

      map.addLayer({
        id: 'alert-poly-label',
        source: POLY_SOURCE,
        type: 'symbol',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.5,
          'text-opacity': LABEL_OPACITY_EXPR,
        },
      });

      map.addLayer({
        id: 'alert-point-circle',
        source: POINT_SOURCE,
        type: 'circle',
        paint: {
          'circle-radius': 6,
          'circle-color': CIRCLE_COLOR_EXPR,
          'circle-opacity': CIRCLE_OPACITY_EXPR,
          'circle-stroke-color': 'rgba(255,255,255,0.8)',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': CIRCLE_STROKE_OPACITY_EXPR,
        },
      });

      map.addLayer({
        id: 'alert-point-label',
        source: POINT_SOURCE,
        type: 'symbol',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-allow-overlap': false,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.5,
          'text-opacity': LABEL_OPACITY_EXPR,
        },
      });

      sourcesReadyRef.current = true;
    },
    [staticGeoJSON],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourcesReadyRef.current) return;

    const polySrc = map.getSource(POLY_SOURCE);
    if (polySrc) polySrc.setData(staticGeoJSON.polygons);

    const ptSrc = map.getSource(POINT_SOURCE);
    if (ptSrc) ptSrc.setData(staticGeoJSON.points);

    prevActiveRef.current.clear();
  }, [staticGeoJSON]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    switchLabelsToHebrew(map);
    setupSources(map);
    if (snapshot) applySnapshot(map, snapshot, prevActiveRef);
  }, [setupSources, snapshot]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !sourcesReadyRef.current) return;
    applySnapshot(map, snapshot, prevActiveRef);
  }, [snapshot]);

  useEffect(() => {
    if (autoFocus && !prevAutoFocusRef.current) {
      prevFitRef.current = '';
    }
    prevAutoFocusRef.current = autoFocus;
  }, [autoFocus]);

  useEffect(() => {
    if (!autoFocus || !snapshot || !cityCache) return;

    const names = [];
    for (const [name, cs] of snapshot) {
      if (statusCode(cs.status) !== 0) names.push(name);
    }
    names.sort();
    const fingerprint = names.join('|');

    if (!fingerprint || fingerprint === prevFitRef.current) return;
    prevFitRef.current = fingerprint;

    fitTimer.current = setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const coords = [];
      for (const name of names) {
        const city = cityCache.get(name);
        if (!city) continue;
        if (city.lat != null && city.lng != null) {
          coords.push([Number(city.lng), Number(city.lat)]);
        }
        const poly = city.polygon ?? city.polygons;
        if (poly) {
          const ring = Array.isArray(poly) ? poly : poly.coordinates?.[0];
          if (Array.isArray(ring) && ring.length > 0) {
            const [a, b] = ring[0];
            const an = Number(a),
              bn = Number(b);
            const isLngLat = an >= 33 && an <= 38 && bn >= 27 && bn <= 35;
            coords.push(isLngLat ? [an, bn] : [bn, an]);
          }
        }
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

    return () => clearTimeout(fitTimer.current);
  }, [snapshot, cityCache, autoFocus]);

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
      </MapView>
    </div>
  );
}

function applySnapshot(map, snapshot, prevActiveRef) {
  const prevActive = prevActiveRef.current;
  const nextActive = new Set();

  if (snapshot) {
    for (const [name, cs] of snapshot) {
      if (cs.status === 'none') continue;
      const code = statusCode(cs.status);
      if (code === 0) continue;

      nextActive.add(name);

      trySetFeatureState(map, POLY_SOURCE, name, { s: code });
      trySetFeatureState(map, POINT_SOURCE, name, { s: code });
    }
  }

  for (const name of prevActive) {
    if (!nextActive.has(name)) {
      trySetFeatureState(map, POLY_SOURCE, name, { s: 0 });
      trySetFeatureState(map, POINT_SOURCE, name, { s: 0 });
    }
  }

  prevActiveRef.current = nextActive;
}

function trySetFeatureState(map, source, id, state) {
  try {
    map.setFeatureState({ source, id }, state);
  } catch {
    // Feature might not exist in this source — that's fine
  }
}
