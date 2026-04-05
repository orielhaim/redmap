const PREALERT_TYPE = 'newsFlash';
const CLEAR_TYPE = 'endAlert';

const MIN_VISUAL_DURATION_MS = 1200;
const DECAY_MS = 5 * 60 * 1000;

export function buildEventSnapshot(event) {
  const snap = new Map();
  if (!event) return snap;

  const ts = toEpoch(event.timestamp);
  const status = statusForType(event.type);

  for (const city of event.cities ?? []) {
    const key = city.name;
    if (!key) continue;
    snap.set(key, {
      status,
      alertType: event.type,
      eventIndex: -1,
      timestamp: ts,
      cityId: city.id ?? null,
    });
  }
  return snap;
}

export function buildCumulativeSnapshot(
  events,
  targetIndex,
  { decayMs = DECAY_MS } = {},
) {
  const state = new Map();
  const end = Math.min(targetIndex, events.length - 1);

  for (let i = 0; i <= end; i++) {
    applyEvent(state, events[i], i);
  }

  if (decayMs > 0 && events[end]) {
    const cutoff = toEpoch(events[end].timestamp) - decayMs;
    for (const [key, cs] of state) {
      if (cs.timestamp < cutoff) {
        state.delete(key);
      }
    }
  }

  return state;
}

export function buildLatestSnapshot(events, options) {
  if (events.length === 0) return new Map();
  return buildCumulativeSnapshot(events, events.length - 1, options);
}

export function mergeWithVisualHold(baseSnapshot, visualHold) {
  if (!visualHold || visualHold.size === 0) return baseSnapshot;
  if (!baseSnapshot) baseSnapshot = new Map();

  const merged = new Map(baseSnapshot);
  const now = Date.now();

  for (const [key, hold] of visualHold) {
    if (now > hold.expireAt) {
      visualHold.delete(key);
      continue;
    }
    if (!merged.has(key)) {
      merged.set(key, hold);
    }
  }

  return merged;
}

export function recordVisualHold(
  visualHold,
  snapshot,
  minVisualMs = MIN_VISUAL_DURATION_MS,
) {
  if (!snapshot) return;
  const expireAt = Date.now() + minVisualMs;

  for (const [key, cs] of snapshot) {
    if (cs.status === 'none' || cs.status === 'ended') continue;
    const existing = visualHold.get(key);
    if (!existing || existing.expireAt < expireAt) {
      visualHold.set(key, { ...cs, expireAt });
    }
  }
}

export function pruneVisualHold(visualHold) {
  const now = Date.now();
  let pruned = false;
  for (const [key, hold] of visualHold) {
    if (now > hold.expireAt) {
      visualHold.delete(key);
      pruned = true;
    }
  }
  return pruned;
}

export { MIN_VISUAL_DURATION_MS };

export function buildStaticCityGeoJSON(cityCache) {
  if (!cityCache) return { polygons: emptyFC(), points: emptyFC() };

  const polyFeatures = [];
  const pointFeatures = [];
  const seen = new Set();

  for (const [key, city] of cityCache) {
    const name = city.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const coords = parsePolygon(city.polygon ?? city.polygons);

    if (coords) {
      polyFeatures.push({
        type: 'Feature',
        properties: { name },
        geometry: { type: 'Polygon', coordinates: [coords] },
      });
    } else if (city.lat != null && city.lng != null) {
      pointFeatures.push({
        type: 'Feature',
        properties: { name },
        geometry: {
          type: 'Point',
          coordinates: [Number(city.lng), Number(city.lat)],
        },
      });
    }
  }

  return {
    polygons: { type: 'FeatureCollection', features: polyFeatures },
    points: { type: 'FeatureCollection', features: pointFeatures },
  };
}

function applyEvent(state, ev, idx) {
  const ts = toEpoch(ev.timestamp);

  for (const city of ev.cities ?? []) {
    const key = city.name;
    if (!key) continue;

    if (ev.type === CLEAR_TYPE) {
      state.set(key, {
        status: 'ended',
        alertType: CLEAR_TYPE,
        eventIndex: idx,
        timestamp: ts,
        cityId: city.id ?? null,
      });
    } else if (ev.type === PREALERT_TYPE) {
      const current = state.get(key);
      if (!current || current.status === 'ended') {
        state.set(key, {
          status: 'prealert',
          alertType: PREALERT_TYPE,
          eventIndex: idx,
          timestamp: ts,
          cityId: city.id ?? null,
        });
      }
    } else {
      state.set(key, {
        status: 'active',
        alertType: ev.type,
        eventIndex: idx,
        timestamp: ts,
        cityId: city.id ?? null,
      });
    }
  }
}

function statusForType(type) {
  if (type === PREALERT_TYPE) return 'prealert';
  if (type === CLEAR_TYPE) return 'ended';
  return 'active';
}

function toEpoch(ts) {
  try {
    return new Date(ts).getTime();
  } catch {
    return 0;
  }
}

export function colorForStatus(status) {
  if (status === 'prealert') return '#f59e0b';
  if (status === 'active') return '#ef4444';
  if (status === 'ended') return '#22c55e';
  return 'rgba(0,0,0,0)';
}

export function colorForType(type) {
  if (type === PREALERT_TYPE) return '#f59e0b';
  if (type === CLEAR_TYPE) return '#22c55e';
  return '#ef4444';
}

export function statusCode(status) {
  if (status === 'active') return 1;
  if (status === 'prealert') return 2;
  if (status === 'ended') return 3;
  return 0;
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
