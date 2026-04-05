const PREALERT_TYPE = 'newsFlash';
const CLEAR_TYPE = 'endAlert';

const DECAY_MS = 5 * 60 * 1000; // 5 minutes

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

export function buildLatestSnapshot(events, options) {
  if (events.length === 0) return new Map();
  return buildCumulativeSnapshot(events, events.length - 1, options);
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
