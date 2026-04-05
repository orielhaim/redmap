'use client';

import { useEffect, useMemo, useCallback } from 'react';
import {
  Map as MapIcon,
  Play,
  RefreshCw,
  Loader2,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCityCache } from '@/hooks/use-city-cache';
import { useTimelinePlayer } from '@/hooks/use-timeline-player';
import { useMapStore, MODES, TIME_PRESETS } from '@/stores/map-store';
import { buildEventSnapshot } from '@/lib/map/alert-engine';
import MapCanvas from '@/components/map/map-canvas';
import HistorySidebar from '@/components/map/history-sidebar';
import TimelineControls from '@/components/map/timeline-controls';
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';

export default function MapPage() {
  const mode = useMapStore((s) => s.mode);
  const sidebarOpen = useMapStore((s) => s.sidebarOpen);
  const activePreset = useMapStore((s) => s.activePreset);
  const selectedEventIndex = useMapStore((s) => s.selectedEventIndex);
  const events = useMapStore((s) => s.activeEvents);
  const historyLoading = useMapStore((s) => s.historyLoading);
  const historyError = useMapStore((s) => s.historyError);

  const enterTimeline = useMapStore((s) => s.enterTimeline);
  const exitTimeline = useMapStore((s) => s.exitTimeline);
  const toggleSidebar = useMapStore((s) => s.toggleSidebar);
  const setSidebarOpen = useMapStore((s) => s.setSidebarOpen);
  const selectPreset = useMapStore((s) => s.selectPreset);
  const setSelectedEventIndex = useMapStore((s) => s.setSelectedEventIndex);
  const toggleSelectedEventIndex = useMapStore(
    (s) => s.toggleSelectedEventIndex,
  );
  const fetchHistory = useMapStore((s) => s.fetchHistory);
  const setCityCache = useMapStore((s) => s.setCityCache);
  const mapAutoFocusPreference = useMapStore((s) => s.mapAutoFocusPreference);
  const setMapAutoFocusPreference = useMapStore(
    (s) => s.setMapAutoFocusPreference,
  );

  const {
    cityCache,
    loading: cacheLoading,
    error: cacheError,
    refresh: refreshCache,
  } = useCityCache();

  useEffect(() => {
    if (cityCache) {
      setCityCache(cityCache);
      fetchHistory();
    }
  }, [cityCache, setCityCache, fetchHistory]);

  const player = useTimelinePlayer(events);

  const autoFocusSuppressedBySpeed =
    mode === MODES.TIMELINE && player.speedMultiplier >= 2;

  const mapAutoFocusActive = useMemo(
    () => mapAutoFocusPreference && !autoFocusSuppressedBySpeed,
    [mapAutoFocusPreference, autoFocusSuppressedBySpeed],
  );

  const activeSnapshot = useMemo(() => {
    if (events.length === 0) return null;

    if (mode === MODES.NORMAL) {
      if (selectedEventIndex !== null && events[selectedEventIndex]) {
        return buildEventSnapshot(events[selectedEventIndex]);
      }
      return null;
    }

    return player.timelineSnapshot;
  }, [
    events,
    mode,
    selectedEventIndex,
    player.timelineSnapshot,
    player.snapshotVersion,
  ]);

  const isLoading = cacheLoading || historyLoading;

  const handleSidebarSeek = useCallback(
    (idx) => {
      if (mode === MODES.TIMELINE) {
        player.seekTo(idx);
        setSelectedEventIndex(null);
      } else {
        toggleSelectedEventIndex(idx);
      }
    },
    [mode, player, setSelectedEventIndex, toggleSelectedEventIndex],
  );

  const handleEnterTimeline = useCallback(() => {
    enterTimeline();
  }, [enterTimeline]);

  const handleExitTimeline = useCallback(() => {
    exitTimeline();
    player.pause();
  }, [exitTimeline, player]);

  const selectedEvent =
    selectedEventIndex !== null ? events[selectedEventIndex] : null;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 flex-wrap">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5">
          <ModeButton
            active={mode === MODES.NORMAL}
            onClick={handleExitTimeline}
          >
            <MapIcon size={13} />
            Normal
          </ModeButton>
          <ModeButton
            active={mode === MODES.TIMELINE}
            onClick={handleEnterTimeline}
          >
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

        <div className="h-4 w-px bg-border" />

        <div
          className={cn(
            'flex items-center gap-2',
            autoFocusSuppressedBySpeed && 'opacity-60',
          )}
        >
          <Label
            htmlFor="map-auto-focus"
            className={cn(
              'text-xs font-normal text-muted-foreground',
              autoFocusSuppressedBySpeed ? 'cursor-default' : 'cursor-pointer',
            )}
          >
            Auto focus
          </Label>
          <Switch
            id="map-auto-focus"
            size="sm"
            checked={mapAutoFocusActive}
            disabled={autoFocusSuppressedBySpeed}
            onCheckedChange={setMapAutoFocusPreference}
          />
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
            <button
              type="button"
              onClick={refreshCache}
              className="underline flex items-center gap-0.5 ml-0.5"
            >
              <RefreshCw size={10} /> retry
            </button>
          </div>
        )}
        {historyError && !historyLoading && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            History error —
            <button
              type="button"
              onClick={() => fetchHistory(true)}
              className="underline flex items-center gap-0.5 ml-0.5"
            >
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
          onClick={toggleSidebar}
          className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        </button>
      </div>

      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ '--sidebar-width': '20rem' }}
      >
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <SidebarInset className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
            <MapCanvas
              cityCache={cityCache}
              snapshot={activeSnapshot}
              autoFocus={mapAutoFocusActive}
              className="flex-1"
            />

            {mode === MODES.TIMELINE && (
              <TimelineControls
                events={events}
                cursor={player.cursor}
                playing={player.playing}
                currentEvent={player.currentEvent}
                speedMultiplier={player.speedMultiplier}
                speedOptions={player.speedOptions}
                onToggle={player.togglePlay}
                onSeek={(idx) => {
                  player.seekTo(idx);
                  setSelectedEventIndex(null);
                }}
                onStepBack={player.stepBack}
                onStepForward={player.stepForward}
                onClose={handleExitTimeline}
                onCycleSpeed={player.cycleSpeed}
                onSetSpeed={player.setSpeed}
              />
            )}
          </SidebarInset>

          <Sidebar
            side="right"
            collapsible="none"
            dir="rtl"
            className={cn(!sidebarOpen && 'hidden')}
          >
            <HistorySidebar
              events={events}
              cursor={
                mode === MODES.TIMELINE ? player.cursor : selectedEventIndex
              }
              playing={player.playing}
              onSeek={handleSidebarSeek}
              loading={historyLoading}
              error={historyError}
              onRefetch={() => fetchHistory(true)}
            />
          </Sidebar>
        </div>
      </SidebarProvider>
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
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
