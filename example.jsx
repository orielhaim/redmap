// components/AlertsMap.tsx
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Map as MapView,
  Source,
  Layer,
  Marker,
  NavigationControl,
} from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapRef } from '@vis.gl/react-maplibre';
import type { MapPolygon, MapPoint } from '@/hooks/useMapData';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const INITIAL_VIEW = { longitude: 35.0, latitude: 31.5, zoom: 7.5 } as const;

const RTL_PLUGIN = {
  pluginUrl:
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js',
  lazy: true,
};

function switchLabelsToHebrew(map: maplibregl.Map) {
  const hebrewTextField: maplibregl.ExpressionSpecification = [
    'coalesce',
    ['get', 'name:he'],
    ['get', 'name'],
  ];

  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;

    const textField = (layer.layout as Record<string, unknown>)?.['text-field'];
    if (!textField) continue;

    try {
      map.setLayoutProperty(layer.id, 'text-field', hebrewTextField);
    } catch {
      // שכבות מסוימות עלולות לזרוק שגיאה - מתעלמים בשקט
    }
  }
}

interface AlertsMapProps {
  polygons: MapPolygon[];
  points: MapPoint[];
  loading: boolean;
  className?: string;
  /** When false, map does not auto fit bounds when features change */
  autoZoom?: boolean;
  /** Called when a polygon is clicked; receives locationId from feature properties */
  onPolygonClick?: (locationId: number) => void;
}

export function AlertsMap({
  polygons,
  points,
  loading,
  className,
  autoZoom = true,
  onPolygonClick,
}: AlertsMapProps) {
  const mapRef = useRef<MapRef>(null);

  const polygonGeoJSON = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: 'FeatureCollection',
      features: polygons.map((p) => ({
        type: 'Feature',
        properties: {
          name: p.name,
          color: p.color,
          locationId: p.locationId,
          alertId: p.alertId,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [p.coordinates],
        },
      })),
    }),
    [polygons],
  );

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) switchLabelsToHebrew(map);
  }, []);

  const fitBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const allCoords: [number, number][] = [];
    for (const p of polygons) {
      for (const c of p.coordinates) allCoords.push(c);
    }
    for (const pt of points) {
      allCoords.push([pt.lng, pt.lat]);
    }
    if (allCoords.length === 0) return;

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const [lng, lat] of allCoords) {
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
      { padding: 60, maxZoom: 14, duration: 600 },
    );
  }, [polygons, points]);

  const featureCount = polygons.length + points.length;
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!autoZoom) return;
    if (featureCount > 0 && featureCount !== prevCountRef.current) {
      prevCountRef.current = featureCount;
      const timer = setTimeout(fitBounds, 150);
      return () => clearTimeout(timer);
    }
    if (featureCount === 0) {
      prevCountRef.current = 0;
    }
  }, [autoZoom, featureCount, fitBounds]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !onPolygonClick) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['alert-polygons-fill'],
      });
      const first = features?.[0];
      const locId = first?.properties?.locationId;
      const id = typeof locId === 'number' ? locId : Number(locId);
      if (Number.isFinite(id)) onPolygonClick(id);
    };
    map.on('click', 'alert-polygons-fill', handler);
    return () => {
      map.off('click', 'alert-polygons-fill', handler);
    };
  }, [onPolygonClick]);

  return (
    <div
      dir="rtl"
      className={cn(
        'relative rounded-lg overflow-hidden border border-neutral-800',
        className,
      )}
    >
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
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.25,
              }}
            />
            <Layer
              id="alert-polygons-border"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 2,
              }}
            />
            <Layer
              id="alert-polygons-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 13,
                'text-anchor': 'center',
                'text-allow-overlap': false,
                'text-max-width': 10,
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(0,0,0,0.75)',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {points.map((pt) => (
          <Marker
            key={`${pt.alertId}-${pt.locationId}`}
            longitude={pt.lng}
            latitude={pt.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center" dir="rtl">
              <span className="mb-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap">
                {pt.name}
              </span>
              <MapPin
                className="size-5"
                style={{ color: pt.color }}
                fill={pt.color}
                fillOpacity={0.4}
              />
            </div>
          </Marker>
        ))}
      </MapView>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 className="size-6 animate-spin text-white" />
          <span className="mr-2 text-sm text-white">טוען מיקומים…</span>
        </div>
      )}
    </div>
  );
}
