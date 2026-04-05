'use client';

import { useState } from 'react';
import { format, subDays, subMonths, startOfYear } from 'date-fns';
import { CalendarIcon, RotateCcw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const ORIGINS = [
  { value: '', label: 'All origins' },
  { value: 'gaza', label: 'Gaza' },
  { value: 'lebanon', label: 'Lebanon' },
  { value: 'westbank', label: 'West Bank' },
  { value: 'iran', label: 'Iran' },
  { value: 'houthi', label: 'Houthi' },
];

const PRESETS = [
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

function DatePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex items-center gap-2 px-3 h-8 rounded-md text-sm border border-border bg-card hover:bg-muted transition-colors',
          !value && 'text-muted-foreground',
        )}
        type="button"
      >
        <CalendarIcon size={13} className="text-muted-foreground" />
        {value ? format(new Date(value), 'MMM d, yyyy') : label}
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-card border-border"
        align="start"
      >
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          disabled={(d) => d > new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function FilterBar() {
  const { filters, setFilters, resetFilters } = useDashboardStore();

  const hasActiveFilters = !!filters.origin;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <Filter size={12} />
        <span>Filters</span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const { start, end } = p.getRange();
              setFilters({ startDate: start, endDate: end });
            }}
            className={cn(
              'px-2.5 h-7 rounded-md text-xs font-medium transition-colors',
              filters.startDate === p.getRange().start &&
                filters.endDate === p.getRange().end
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            type="button"
          >
            {p.label}
          </button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Date pickers */}
      <div className="flex items-center gap-1.5">
        <DatePicker
          value={filters.startDate}
          onChange={(v) => setFilters({ startDate: v })}
          label="Start date"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <DatePicker
          value={filters.endDate}
          onChange={(v) => setFilters({ endDate: v })}
          label="End date"
        />
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Origin */}
      <Select
        value={filters.origin || ''}
        onValueChange={(v) => setFilters({ origin: v === '' ? '' : v })}
      >
        <SelectTrigger className="h-8 w-36 text-xs bg-card border-border">
          <SelectValue placeholder="All origins" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {ORIGINS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          type="button"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      )}
    </div>
  );
}
