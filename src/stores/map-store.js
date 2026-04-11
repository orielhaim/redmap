import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { getHistory } from '@/lib/api/siren';
import { format, subDays, subWeeks, subMonths, startOfDay } from 'date-fns';
import { mergeConsecutiveEvents } from '@/lib/map/alert-engine';
import { idbJSONStorage } from '@/lib/preferences/storage';

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

function toEpochStart(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}
function toEpochEnd(dateStr) {
  return new Date(`${dateStr}T23:59:59Z`).getTime();
}

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

function recomputeActiveEvents(state) {
  const raw = state.rawEvents;
  const merge = state.mergeEnabled;
  return merge ? mergeConsecutiveEvents(raw) : raw;
}

export const useMapStore = create(
  persist(
    immer((set, get) => ({
      // ── Persisted preferences ──
      mapAutoFocusPreference: true,
      activePreset: '24h',
      mergeEnabled: false,

      // ── Ephemeral state (NOT persisted) ──
      mode: MODES.NORMAL,
      sidebarOpen: true,
      timeRange: TIME_PRESETS[0].getDates(),
      selectedEventIndex: null,

      eventsById: {},
      fetchedRanges: [],
      rawEvents: [],
      activeEvents: [],
      historyLoading: false,
      historyError: null,
      _fetchId: 0,
      _cityCache: null,

      timePresets: TIME_PRESETS,
      modes: MODES,

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

      setSidebarOpen: (open) =>
        set((s) => {
          s.sidebarOpen = Boolean(open);
        }),

      setMapAutoFocusPreference: (enabled) =>
        set((s) => {
          s.mapAutoFocusPreference = Boolean(enabled);
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
        get().fetchHistory();
      },

      setMergeEnabled: (val) =>
        set((s) => {
          s.mergeEnabled = val;
          s.selectedEventIndex = null;
          s.activeEvents = recomputeActiveEvents({
            rawEvents: s.rawEvents,
            mergeEnabled: val,
          });
        }),

      toggleMerge: () =>
        set((s) => {
          s.mergeEnabled = !s.mergeEnabled;
          s.selectedEventIndex = null;
          s.activeEvents = recomputeActiveEvents({
            rawEvents: s.rawEvents,
            mergeEnabled: s.mergeEnabled,
          });
        }),

      fetchHistory: async (forceRefresh = false) => {
        const state = get();
        const { timeRange, fetchedRanges, eventsById } = state;
        const cityCache = state._cityCache;

        const requestedStartMs = toEpochStart(timeRange.startDate);
        const requestedEndMs = toEpochEnd(timeRange.endDate);

        const fetchId = state._fetchId + 1;
        set((s) => {
          s._fetchId = fetchId;
          s.historyError = null;
        });

        if (!forceRefresh) {
          const gaps = findGaps(
            fetchedRanges,
            requestedStartMs,
            requestedEndMs,
          );

          if (gaps.length === 0) {
            const filtered = filterEventsFromCache(
              eventsById,
              requestedStartMs,
              requestedEndMs,
            );
            const enriched = enrichEvents(filtered, cityCache);
            set((s) => {
              s.rawEvents = enriched;
              s.activeEvents = recomputeActiveEvents({
                rawEvents: enriched,
                mergeEnabled: s.mergeEnabled,
              });
              s.historyLoading = false;
            });
            return;
          }

          set((s) => {
            s.historyLoading = true;
          });

          const partialFiltered = filterEventsFromCache(
            eventsById,
            requestedStartMs,
            requestedEndMs,
          );
          if (partialFiltered.length > 0) {
            const enrichedPartial = enrichEvents(partialFiltered, cityCache);
            set((s) => {
              s.rawEvents = enrichedPartial;
              s.activeEvents = recomputeActiveEvents({
                rawEvents: enrichedPartial,
                mergeEnabled: s.mergeEnabled,
              });
            });
          }

          try {
            const newEventsById = { ...eventsById };
            let newRanges = [...fetchedRanges];

            for (const gap of gaps) {
              if (get()._fetchId !== fetchId) return;

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

            if (get()._fetchId !== fetchId) return;

            const filtered = filterEventsFromCache(
              newEventsById,
              requestedStartMs,
              requestedEndMs,
            );
            const enriched = enrichEvents(filtered, cityCache);

            set((s) => {
              s.eventsById = newEventsById;
              s.fetchedRanges = newRanges;
              s.rawEvents = enriched;
              s.activeEvents = recomputeActiveEvents({
                rawEvents: enriched,
                mergeEnabled: s.mergeEnabled,
              });
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
          set((s) => {
            s.historyLoading = true;
            s.eventsById = {};
            s.fetchedRanges = [];
            s.rawEvents = [];
            s.activeEvents = [];
          });

          try {
            const rows = await fetchRange(
              timeRange.startDate,
              timeRange.endDate,
            );

            if (get()._fetchId !== fetchId) return;

            const newEventsById = {};
            for (const ev of rows) {
              const id =
                ev.id ?? `${ev.timestamp}_${ev.cities?.[0]?.name ?? ''}`;
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
              s.rawEvents = enriched;
              s.activeEvents = recomputeActiveEvents({
                rawEvents: enriched,
                mergeEnabled: s.mergeEnabled,
              });
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

      setCityCache: (cityCache) => {
        set((s) => {
          s._cityCache = cityCache;
        });
        const state = get();
        if (state.rawEvents.length > 0) {
          const enriched = enrichEvents(
            state.rawEvents.map(stripEnrichment),
            cityCache,
          );
          set((s) => {
            s.rawEvents = enriched;
            s.activeEvents = recomputeActiveEvents({
              rawEvents: enriched,
              mergeEnabled: s.mergeEnabled,
            });
          });
        }
      },

      clearCache: () =>
        set((s) => {
          s.eventsById = {};
          s.fetchedRanges = [];
          s.rawEvents = [];
          s.activeEvents = [];
        }),

      ingestRealtimeEvent: (ev) => {
        const state = get();
        const id = ev.id ?? `${ev.timestamp}_${ev.cities?.[0]?.name ?? ''}`;

        // Dedupe: skip if already present
        if (state.eventsById[id]) return null;

        const enriched = enrichEvents([ev], state._cityCache)[0];
        const enrichedWithId = { ...enriched, id };

        const { timeRange } = state;
        const startMs = toEpochStart(timeRange.startDate);
        const endMs = toEpochEnd(timeRange.endDate);
        const evTs = new Date(ev.timestamp).getTime();
        const inRange = evTs >= startMs && evTs <= endMs;

        let activeIndex = null;

        set((s) => {
          s.eventsById[id] = enrichedWithId;

          if (inRange) {
            // Insert in ascending timestamp order
            const insertIdx = s.rawEvents.findIndex(
              (e) => new Date(e.timestamp).getTime() > evTs,
            );
            if (insertIdx === -1) {
              s.rawEvents.push(enrichedWithId);
            } else {
              s.rawEvents.splice(insertIdx, 0, enrichedWithId);
            }
            s.activeEvents = recomputeActiveEvents({
              rawEvents: s.rawEvents,
              mergeEnabled: s.mergeEnabled,
            });
            // Find the index of this event inside activeEvents by id
            const idx = s.activeEvents.findIndex((e) => e.id === id);
            activeIndex = idx >= 0 ? idx : s.activeEvents.length - 1;
          }
        });

        return activeIndex;
      },

      openMapForLatestEvent: (activeIndex = null) => {
        const state = get();
        const idx =
          activeIndex !== null ? activeIndex : state.activeEvents.length - 1;
        set((s) => {
          s.mode = MODES.NORMAL;
          s.sidebarOpen = true;
          s.selectedEventIndex = idx >= 0 ? idx : null;
        });
      },
    })),
    {
      name: 'radar-map',
      storage: idbJSONStorage,
      skipHydration: true,
      partialize: (state) => ({
        mapAutoFocusPreference: state.mapAutoFocusPreference,
        activePreset: state.activePreset,
        mergeEnabled: state.mergeEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const preset = TIME_PRESETS.find((p) => p.label === state.activePreset);
        if (preset) {
          useMapStore.setState({ timeRange: preset.getDates() });
        }
      },
    },
  ),
);

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

function stripEnrichment(ev) {
  return {
    ...ev,
    cities: (ev.cities ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      ...(c.countdown != null ? { countdown: c.countdown } : {}),
      ...(c.zone != null ? { zone: c.zone } : {}),
    })),
  };
}

export { MODES, TIME_PRESETS };
