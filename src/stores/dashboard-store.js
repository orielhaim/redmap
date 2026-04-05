'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { subDays, format } from 'date-fns';
import { idbJSONStorage } from '@/lib/preferences/storage';

const today = new Date();
const defaultStart = format(subDays(today, 30), 'yyyy-MM-dd');
const defaultEnd = format(today, 'yyyy-MM-dd');

export const useDashboardStore = create(
  persist(
    immer((set) => ({
      filters: {
        startDate: defaultStart,
        endDate: defaultEnd,
        origin: '',
      },
      timelineGroup: 'day',
      distributionGroupBy: 'category',
      citiesTable: {
        limit: 20,
        offset: 0,
        sort: 'count',
        order: 'desc',
        search: '',
        zone: '',
      },
      historyTable: {
        limit: 20,
        offset: 0,
        sort: 'timestamp',
        order: 'desc',
        search: '',
        category: '',
        origin: '',
      },

      setFilters: (partial) =>
        set((s) => {
          Object.assign(s.filters, partial);
          s.citiesTable.offset = 0;
          s.historyTable.offset = 0;
        }),

      setTimelineGroup: (g) =>
        set((s) => {
          s.timelineGroup = g;
        }),

      setDistributionGroupBy: (g) =>
        set((s) => {
          s.distributionGroupBy = g;
        }),

      setCitiesTable: (partial) =>
        set((s) => {
          Object.assign(s.citiesTable, partial);
        }),

      setHistoryTable: (partial) =>
        set((s) => {
          Object.assign(s.historyTable, partial);
        }),

      resetFilters: () =>
        set((s) => {
          s.filters = {
            startDate: defaultStart,
            endDate: defaultEnd,
            origin: '',
          };
          s.citiesTable.offset = 0;
          s.historyTable.offset = 0;
        }),
    })),
    {
      name: 'redmap-dashboard',
      storage: idbJSONStorage,
      skipHydration: true,
      partialize: (state) => ({
        filters: state.filters,
        timelineGroup: state.timelineGroup,
      }),
      merge: (persisted, current) => {
        if (!persisted) return current;
        return {
          ...current,
          ...persisted,
          filters: {
            ...current.filters,
            ...(persisted.filters ?? {}),
          },
        };
      },
    },
  ),
);
