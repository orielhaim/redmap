'use client';

import { useState, useMemo, useCallback } from 'react';
import { format, subDays, subWeeks, subMonths, startOfDay } from 'date-fns';
import { Map as MapIcon, Play, RefreshCw, Loader2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCityCache } from '@/hooks/use-city-cache';
import { useMapHistory } from '@/hooks/use-map-history';
import { useTimelinePlayer } from '@/hooks/use-timeline-player';
import {
  buildEventSnapshot,
  buildCumulativeSnapshot,
  buildLatestSnapshot,
} from '@/lib/map/alert-engine';
import MapCanvas from '@/components/map/map-canvas';
import HistorySidebar from '@/components/map/history-sidebar';
import TimelineControls from '@/components/map/timeline-controls';

const MODES = { NORMAL: 'normal', TIMELINE: 'timeline' };

const TIME_PRESETS = [
  { label: '24h', getDates: () => ({ startDate: fmt(subDays(new Date(), 1)),  endDate: fmt(new Date()) }) },
  { label: '3d',  getDates: () => ({ startDate: fmt(subDays(new Date(), 3)),  endDate: fmt(new Date()) }) },
  { label: '7d',  getDates: () => ({ startDate: fmt(subWeeks(new Date(), 1)), endDate: fmt(new Date()) }) },
  { label: '1mo', getDates: () => ({ startDate: fmt(subMonths(new Date(), 1)),endDate: fmt(new Date()) }) },
];

function fmt(d) { return format(startOfDay(d), 'yyyy-MM-dd'); }

export default function MapPage() {
  const [mode, setMode] = useState(MODES.NORMAL);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeRange, setTimeRange] = useState(() => TIME_PRESETS[0].getDates());
  const [activePreset, setActivePreset] = useState('24h');

  const [selectedEventIndex, setSelectedEventIndex] = useState(null);

  const { cityCache, loading: cacheLoading, error: cacheError, refresh: refreshCache } = useCityCache();

  const { events, loading: historyLoading, error: historyError, refetch } =
    useMapHistory(timeRange, cityCache);

  const player = useTimelinePlayer(events);

  const activeSnapshot = useMemo(() => {
    if (events.length === 0) return null;

    if (mode === MODES.NORMAL) {
      if (selectedEventIndex !== null) {
        return buildEventSnapshot(events[selectedEventIndex]);
      }
      return buildLatestSnapshot(events);
    }

    return buildCumulativeSnapshot(events, player.cursor);
  }, [events, mode, selectedEventIndex, player.cursor]);

  const isLoading = cacheLoading || historyLoading;

  const selectPreset = useCallback((preset) => {
    setActivePreset(preset.label);
    setTimeRange(preset.getDates());
    setSelectedEventIndex(null);
  }, []);

  const handleSidebarSeek = useCallback((idx) => {
    if (mode === MODES.TIMELINE) {
      player.seekTo(idx);
      setSelectedEventIndex(null);
    } else {
      setSelectedEventIndex((prev) => prev === idx ? null : idx);
    }
  }, [mode, player]);

  const handleEnterTimeline = useCallback(() => {
    setMode(MODES.TIMELINE);
    setSelectedEventIndex(null);
  }, []);

  const handleExitTimeline = useCallback(() => {
    setMode(MODES.NORMAL);
    player.pause();
    setSelectedEventIndex(null);
  }, [player]);

  const selectedEvent = selectedEventIndex !== null ? events[selectedEventIndex] : null;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 flex-wrap">

        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5">
          <ModeButton active={mode === MODES.NORMAL} onClick={handleExitTimeline}>
            <MapIcon size={13} />
            Normal
          </ModeButton>
          <ModeButton active={mode === MODES.TIMELINE} onClick={handleEnterTimeline}>
            <Play size={13} />
            Timeline
          </ModeButton>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          {TIME_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => selectPreset(p)}
              className={cn(
                'px-2.5 h-7 rounded-md text-xs font-medium transition-colors',
                activePreset === p.label
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={11} className="animate-spin" />
            {cacheLoading ? 'Loading city data…' : 'Loading history…'}
          </div>
        )}
        {cacheError && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <Database size={11} />
            City cache error —
            <button type="button" onClick={refreshCache} className="underline flex items-center gap-0.5 ml-0.5">
              <RefreshCw size={10} /> retry
            </button>
          </div>
        )}
        {historyError && !historyLoading && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            History error —
            <button type="button" onClick={refetch} className="underline flex items-center gap-0.5 ml-0.5">
              <RefreshCw size={10} /> retry
            </button>
          </div>
        )}

        {selectedEvent && mode === MODES.NORMAL && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              Showing event ({(selectedEvent.cities ?? []).length} cities)
            </span>
            <button
              type="button"
              onClick={() => setSelectedEventIndex(null)}
              className="text-primary hover:underline"
            >
              clear
            </button>
          </div>
        )}

        <div className="flex-1" />

        {!isLoading && !historyError && events.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {events.length.toLocaleString()} events
          </span>
        )}

        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <MapCanvas
            cityCache={cityCache}
            snapshot={activeSnapshot}
            className="flex-1"
          />

          {mode === MODES.TIMELINE && (
            <TimelineControls
              events={events}
              cursor={player.cursor}
              playing={player.playing}
              currentEvent={player.currentEvent}
              onToggle={player.togglePlay}
              onSeek={(idx) => { player.seekTo(idx); setSelectedEventIndex(null); }}
              onStepBack={player.stepBack}
              onStepForward={player.stepForward}
              onClose={handleExitTimeline}
            />
          )}
        </div>

        {sidebarOpen && (
          <div className="shrink-0 w-80 border-l border-border overflow-hidden">
            <HistorySidebar
              events={events}
              cursor={mode === MODES.TIMELINE ? player.cursor : selectedEventIndex}
              playing={player.playing}
              mode={mode}
              onSeek={handleSidebarSeek}
              loading={historyLoading}
              error={historyError}
              onRefetch={refetch}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
