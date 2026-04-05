import { format, subDays, subMonths, startOfYear } from 'date-fns';

export const HOME_DATE_PRESETS = [
  {
    label: '24h',
    getRange: () => ({
      start: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '7d',
    getRange: () => ({
      start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '30d',
    getRange: () => ({
      start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '3mo',
    getRange: () => ({
      start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: 'YTD',
    getRange: () => ({
      start: format(startOfYear(new Date()), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
];
