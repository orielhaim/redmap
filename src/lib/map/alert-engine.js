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

export function buildCumulativeSnapshot(events, targetIndex, { decayMs = DECAY_MS } = {}) {
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

// ── Latest snapshot (normal mode, all events) ──

export function buildLatestSnapshot(events, options) {
  if (events.length === 0) return new Map();
  return buildCumulativeSnapshot(events, events.length - 1, options);
}

export function mergeWithVisualHold(baseSnapshot, visualHold) {
  if (!visualHold || visualHold.size === 0) return baseSnapshot;
  if (!baseSnapshot) return visualHold;

  const merged = new Map(baseSnapshot);
  const now = Date.now();

  for (const [key, hold] of visualHold) {
    if (now > hold.expireAt) {
      visualHold.delete(key);
      continue;
    }
    // Only add if not already in base (base takes priority for status)
    if (!merged.has(key)) {
      merged.set(key, hold);
    }
  }

  return merged;
}

/**
 * Record cities from a snapshot into the visual hold map.
 * Called whenever the cursor advances.
 */
export function recordVisualHold(visualHold, snapshot, minVisualMs = MIN_VISUAL_DURATION_MS) {
  if (!snapshot) return;
  const expireAt = Date.now() + minVisualMs;

  for (const [key, cs] of snapshot) {
    if (cs.status === 'none' || cs.status === 'ended') continue;
    const existing = visualHold.get(key);
    // Extend expiry if this is a new or refreshed alert
    if (!existing || existing.expireAt < expireAt) {
      visualHold.set(key, { ...cs, expireAt });
    }
  }
}

/**
 * Prune expired entries from visual hold. Returns true if anything was removed.
 */
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

// ── Pre-computed polygon index ──
// Build once when events + cityCache are ready, maps cityName → polygon coords.

/**
 * Pre-resolve all city geometries from events against the city cache.
 * Returns a Map<cityName, { polygon: coords | null, lat, lng, ... }>
 * This avoids repeated cache lookups during playback.
 */
export function buildGeometryIndex(events, cityCache) {
  if (!cityCache) return new Map();

  const index = new Map();

  for (const ev of events) {
    for (const city of ev.cities ?? []) {
      const name = city.name;
      if (!name || index.has(name)) continue;

      const cached = cityCache.get(name) ?? cityCache.get(String(city.id)) ?? null;
      if (cached) {
        index.set(name, cached);
      }
    }
  }

  return index;
}

// ── Internals ──

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
  try { return new Date(ts).getTime(); }
  catch { return 0; }
}

export function colorForStatus(status) {
  if (status === 'prealert') return '#f59e0b';
  if (status === 'active')   return '#ef4444';
  if (status === 'ended')    return '#22c55e';
  return 'rgba(0,0,0,0)';
}

export function colorForType(type) {
  if (type === PREALERT_TYPE) return '#f59e0b';
  if (type === CLEAR_TYPE)    return '#22c55e';
  return '#ef4444';
}
