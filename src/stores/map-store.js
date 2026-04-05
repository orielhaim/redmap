import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getHistory } from '@/lib/api/redalert';
import {
  format,
  subDays,
  subWeeks,
  subMonths,
  startOfDay,
  parseISO,
} from 'date-fns';

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

const MODES = { NORMAL: 'normal', TIMELINE: 'timeline' };

function fmt(d) {
  return format(startOfDay(d), 'yyyy-MM-dd');
}

const TIME_PRESETS = [
  {
    label: '24h',
    getDates: () => ({
      startDate: fmt(subDays(new Date(), 1)),
      endDate: fmt(new Date()),
    }),
  },
  {
    label: '3d',
    getDates: () => ({
      startDate: fmt(subDays(new Date(), 3)),
      endDate: fmt(new Date()),
    }),
  },
  {
    label: '7d',
    getDates: () => ({
      startDate: fmt(subWeeks(new Date(), 1)),
      endDate: fmt(new Date()),
    }),
  },
  {
    label: '1mo',
    getDates: () => ({
      startDate: fmt(subMonths(new Date(), 1)),
      endDate: fmt(new Date()),
    }),
  },
];

/**
 * Parse a date string to epoch ms (start of day or end of day).
 */
function toEpochStart(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}
function toEpochEnd(dateStr) {
  return new Date(`${dateStr}T23:59:59Z`).getTime();
}

/**
 * The history cache stores all fetched events keyed by their timestamp.
 * We also track which date ranges have been fully fetched so we can
 * compute the "gap" when the user widens the range.
 *
 * fetchedRanges: Array<{ startMs: number, endMs: number }>
 *   – sorted, non-overlapping intervals that we've already loaded.
 *
 * eventsById: Map-like object keyed by event id → event
 *   (we use a plain object so immer can track it)
 */

function mergeRange(ranges, newRange) {
  const merged = [];
  let inserted = false;

  for (const r of ranges) {
    if (r.endMs < newRange.startMs - 1) {
      merged.push(r);
    } else if (r.startMs > newRange.endMs + 1) {
      if (!inserted) {
        merged.push(newRange);
        inserted = true;
      }
      merged.push(r);
    } else {
      newRange = {
        startMs: Math.min(newRange.startMs, r.startMs),
        endMs: Math.max(newRange.endMs, r.endMs),
      };
    }
  }

  if (!inserted) merged.push(newRange);
  return merged;
}

/**
 * Given the desired [startMs, endMs] and already-fetched ranges,
 * return an array of gap ranges that still need fetching.
 */
function findGaps(fetchedRanges, startMs, endMs) {
  const gaps = [];
  let cursor = startMs;

  for (const r of fetchedRanges) {
    if (r.startMs > cursor && cursor < endMs) {
      gaps.push({ startMs: cursor, endMs: Math.min(r.startMs - 1, endMs) });
    }
    cursor = Math.max(cursor, r.endMs + 1);
  }

  if (cursor <= endMs) {
    gaps.push({ startMs: cursor, endMs });
  }

  return gaps;
}

function msToDateStr(ms) {
  return format(new Date(ms), 'yyyy-MM-dd');
}

function enrichEvents(events, cityCache) {
  if (!cityCache) return events;
  return events.map((ev) => ({
    ...ev,
    cities: (ev.cities ?? []).map((c) => {
      const cached =
        cityCache.get(String(c.id)) ?? cityCache.get(c.name) ?? null;
      return cached ? { ...cached, ...c } : c;
    }),
  }));
}

async function fetchRange(startDate, endDate, origin) {
  let allData = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await getHistory({
      startDate,
      endDate,
      origin: origin || undefined,
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

  return allData;
}

export const useMapStore = create(
  immer((set, get) => ({
    // ─── UI state ───
    mode: MODES.NORMAL,
    sidebarOpen: true,
    activePreset: '24h',
    timeRange: TIME_PRESETS[0].getDates(),
    selectedEventIndex: null,

    // ─── History cache ───
    eventsById: {},
    fetchedRanges: [],
    // Current filtered+sorted events for the active time range
    activeEvents: [],
    historyLoading: false,
    historyError: null,
    // Track current fetch so we can cancel
    _fetchId: 0,

    // ─── Computed/derived ───
    timePresets: TIME_PRESETS,
    modes: MODES,

    // ─── Actions ───

    setMode: (mode) =>
      set((s) => {
        s.mode = mode;
        s.selectedEventIndex = null;
      }),

    enterTimeline: () =>
      set((s) => {
        s.mode = MODES.TIMELINE;
        s.selectedEventIndex = null;
      }),

    exitTimeline: () =>
      set((s) => {
        s.mode = MODES.NORMAL;
        s.selectedEventIndex = null;
      }),

    toggleSidebar: () =>
      set((s) => {
        s.sidebarOpen = !s.sidebarOpen;
      }),

    setSelectedEventIndex: (idx) =>
      set((s) => {
        s.selectedEventIndex = idx;
      }),

    toggleSelectedEventIndex: (idx) =>
      set((s) => {
        s.selectedEventIndex = s.selectedEventIndex === idx ? null : idx;
      }),

    selectPreset: (preset) => {
      const dates = preset.getDates();
      set((s) => {
        s.activePreset = preset.label;
        s.timeRange = dates;
        s.selectedEventIndex = null;
      });
      // Trigger fetch after state update
      get().fetchHistory();
    },

    /**
     * Core optimized fetch. Computes gaps between what we already have
     * and what we need, fetches only the missing ranges, merges into cache,
     * then recomputes activeEvents from the full cache.
     */
    fetchHistory: async (forceRefresh = false) => {
      const state = get();
      const { timeRange, fetchedRanges, eventsById } = state;
      const cityCache = state._cityCache;

      const requestedStartMs = toEpochStart(timeRange.startDate);
      const requestedEndMs = toEpochEnd(timeRange.endDate);

      // Increment fetch ID to track cancellation
      const fetchId = state._fetchId + 1;
      set((s) => {
        s._fetchId = fetchId;
        s.historyError = null;
      });

      // If not forcing refresh, check if we already fully cover this range
      if (!forceRefresh) {
        const gaps = findGaps(fetchedRanges, requestedStartMs, requestedEndMs);

        if (gaps.length === 0) {
          // We already have all the data — just recompute activeEvents
          const filtered = filterEventsFromCache(
            eventsById,
            requestedStartMs,
            requestedEndMs,
          );
          const enriched = enrichEvents(filtered, cityCache);
          set((s) => {
            s.activeEvents = enriched;
            s.historyLoading = false;
          });
          return;
        }

        // We have gaps to fill
        set((s) => {
          s.historyLoading = true;
        });

        // Meanwhile, show what we already have instantly
        const partialFiltered = filterEventsFromCache(
          eventsById,
          requestedStartMs,
          requestedEndMs,
        );
        if (partialFiltered.length > 0) {
          const enrichedPartial = enrichEvents(partialFiltered, cityCache);
          set((s) => {
            s.activeEvents = enrichedPartial;
          });
        }

        try {
          const newEventsById = { ...eventsById };
          let newRanges = [...fetchedRanges];

          for (const gap of gaps) {
            if (get()._fetchId !== fetchId) return; // cancelled

            const startDate = msToDateStr(gap.startMs);
            const endDate = msToDateStr(gap.endMs);
            const rows = await fetchRange(startDate, endDate);

            for (const ev of rows) {
              const id =
                ev.id ?? `${ev.timestamp}_${ev.cities?.[0]?.name ?? ''}`;
              newEventsById[id] = ev;
            }

            newRanges = mergeRange(newRanges, {
              startMs: gap.startMs,
              endMs: gap.endMs,
            });
          }

          if (get()._fetchId !== fetchId) return; // cancelled

          const filtered = filterEventsFromCache(
            newEventsById,
            requestedStartMs,
            requestedEndMs,
          );
          const enriched = enrichEvents(filtered, cityCache);

          set((s) => {
            s.eventsById = newEventsById;
            s.fetchedRanges = newRanges;
            s.activeEvents = enriched;
            s.historyLoading = false;
          });
        } catch (err) {
          if (get()._fetchId !== fetchId) return;
          set((s) => {
            s.historyError = err?.message ?? 'Failed to load history';
            s.historyLoading = false;
          });
        }
      } else {
        // Force refresh — clear cache and refetch everything
        set((s) => {
          s.historyLoading = true;
          s.eventsById = {};
          s.fetchedRanges = [];
          s.activeEvents = [];
        });

        try {
          const rows = await fetchRange(timeRange.startDate, timeRange.endDate);

          if (get()._fetchId !== fetchId) return;

          const newEventsById = {};
          for (const ev of rows) {
            const id = ev.id ?? `${ev.timestamp}_${ev.cities?.[0]?.name ?? ''}`;
            newEventsById[id] = ev;
          }

          const filtered = filterEventsFromCache(
            newEventsById,
            requestedStartMs,
            requestedEndMs,
          );
          const enriched = enrichEvents(filtered, cityCache);

          set((s) => {
            s.eventsById = newEventsById;
            s.fetchedRanges = [
              { startMs: requestedStartMs, endMs: requestedEndMs },
            ];
            s.activeEvents = enriched;
            s.historyLoading = false;
          });
        } catch (err) {
          if (get()._fetchId !== fetchId) return;
          set((s) => {
            s.historyError = err?.message ?? 'Failed to load history';
            s.historyLoading = false;
          });
        }
      }
    },

    /**
     * Re-enrich activeEvents when cityCache becomes available or changes.
     */
    setCityCache: (cityCache) => {
      set((s) => {
        s._cityCache = cityCache;
      });
      // Re-enrich existing active events
      const state = get();
      if (state.activeEvents.length > 0) {
        const enriched = enrichEvents(
          state.activeEvents.map(stripEnrichment),
          cityCache,
        );
        set((s) => {
          s.activeEvents = enriched;
        });
      }
      // Also re-enrich the full cache
      if (cityCache && Object.keys(state.eventsById).length > 0) {
        const reEnriched = {};
        for (const [id, ev] of Object.entries(state.eventsById)) {
          reEnriched[id] = ev; // raw events stay raw in cache
        }
      }
    },

    // Internal ref to cityCache (not serialized)
    _cityCache: null,

    /**
     * Clear the entire cache (e.g. if API key changes).
     */
    clearCache: () =>
      set((s) => {
        s.eventsById = {};
        s.fetchedRanges = [];
        s.activeEvents = [];
      }),
  })),
);

/**
 * Filter events from the flat cache object by timestamp range,
 * return sorted array.
 */
function filterEventsFromCache(eventsById, startMs, endMs) {
  const result = [];
  for (const ev of Object.values(eventsById)) {
    const ts = new Date(ev.timestamp).getTime();
    if (ts >= startMs && ts <= endMs) {
      result.push(ev);
    }
  }
  result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return result;
}

/**
 * Strip enrichment so we can re-enrich with new cityCache.
 * We only need the original city fields.
 */
function stripEnrichment(ev) {
  return {
    ...ev,
    cities: (ev.cities ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      // keep only the original API fields
      ...(c.countdown != null ? { countdown: c.countdown } : {}),
      ...(c.zone != null ? { zone: c.zone } : {}),
    })),
  };
}

// Export constants for use in components
export { MODES, TIME_PRESETS };
