'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colorForType } from '@/lib/map/alert-engine';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function tsMs(ts) {
  try {
    return parseISO(ts).getTime();
  } catch {
    return 0;
  }
}

function formatTs(ts) {
  if (!ts) return '--:--';
  try {
    return format(parseISO(ts), 'HH:mm:ss');
  } catch {
    return '--:--';
  }
}

function formatTickLabel(ms, multiDay) {
  const d = new Date(ms);
  if (multiDay) return format(d, 'dd/MM HH:mm');
  return format(d, 'HH:mm');
}

function tickIntervalMs(rangMs) {
  if (rangMs <= 2 * 3600_000) return 15 * 60_000;
  if (rangMs <= 12 * 3600_000) return 60 * 60_000;
  if (rangMs <= 3 * 86400_000) return 6 * 3600_000;
  if (rangMs <= 7 * 86400_000) return 12 * 3600_000;
  return 24 * 3600_000;
}

function TimeScrubber({ events, cursor, startMs, endMs, onSeek }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const duration = Math.max(endMs - startMs, 1);
  const multiDay = duration > 86400_000;
  const intervalMs = tickIntervalMs(duration);

  const marks = useMemo(
    () =>
      events.map((ev, idx) => ({
        pos: (tsMs(ev.timestamp) - startMs) / duration,
        color: colorForType(ev.type),
        idx,
      })),
    [events, startMs, duration],
  );

  const ticks = useMemo(() => {
    const result = [];
    if (duration <= 0) return result;
    const firstTick = Math.ceil(startMs / intervalMs) * intervalMs;
    for (let t = firstTick; t <= endMs; t += intervalMs) {
      result.push({
        pos: (t - startMs) / duration,
        label: formatTickLabel(t, multiDay),
      });
    }
    return result;
  }, [startMs, endMs, duration, intervalMs, multiDay]);

  const cursorPos =
    events.length > 0
      ? (tsMs(events[cursor]?.timestamp) - startMs) / duration
      : 0;

  const seekToPos = useCallback(
    (pos) => {
      if (events.length === 0) return;
      const targetMs = startMs + pos * duration;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < events.length; i++) {
        const dist = Math.abs(tsMs(events[i].timestamp) - targetMs);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      onSeek(best);
    },
    [events, startMs, duration, onSeek],
  );

  const posFromEvent = useCallback((e) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      seekToPos(posFromEvent(e));
    },
    [seekToPos, posFromEvent],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragging) return;
      seekToPos(posFromEvent(e));
    },
    [dragging, seekToPos, posFromEvent],
  );

  const handlePointerUp = useCallback(() => setDragging(false), []);

  return (
    <div className="flex flex-col gap-0 select-none" dir="ltr">
      <div
        ref={trackRef}
        className="relative h-8 cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute inset-x-0 top-3 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary/30 rounded-full"
            style={{ width: `${cursorPos * 100}%` }}
          />
        </div>

        {marks.map(({ pos, color, idx }) => (
          <div
            key={idx}
            className="absolute top-2 w-px h-4 rounded-full pointer-events-none"
            style={{
              left: `${pos * 100}%`,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
        ))}

        <div
          className={cn(
            'absolute top-1.5 size-5 -translate-x-1/2 rounded-full border-2 border-primary bg-card shadow-md pointer-events-none transition-shadow',
            dragging && 'shadow-lg shadow-primary/30',
          )}
          style={{ left: `${cursorPos * 100}%` }}
        />
      </div>

      <div className="relative h-5 overflow-hidden">
        {ticks.map(({ pos, label }) => (
          <span
            key={label}
            className="absolute -translate-x-1/2 text-[9px] text-muted-foreground/70 whitespace-nowrap pointer-events-none"
            style={{ left: `${pos * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TimelineControls({
  events,
  cursor,
  playing,
  currentEvent,
  speedMultiplier,
  speedOptions,
  onToggle,
  onSeek,
  onStepBack,
  onStepForward,
  onSetSpeed,
}) {
  const total = events.length;

  const startMs = useMemo(
    () => (total > 0 ? tsMs(events[0].timestamp) : 0),
    [events, total],
  );
  const endMs = useMemo(
    () => (total > 0 ? tsMs(events[total - 1].timestamp) : 0),
    [events, total],
  );

  const currentTs = currentEvent?.timestamp;
  const currentDate = currentTs ? format(parseISO(currentTs), 'dd/MM') : null;
  const speedOpts = speedOptions ?? [1, 2, 5, 10];

  return (
    <div
      className="flex flex-col gap-2 px-4 pt-2 pb-3 bg-card/95 backdrop-blur border-t border-border"
      dir="ltr"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums text-foreground">
            {formatTs(currentTs)}
          </span>
          {currentDate && (
            <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              {currentDate}
            </span>
          )}
        </div>
      </div>

      {total > 0 && (
        <TimeScrubber
          events={events}
          cursor={cursor}
          startMs={startMs}
          endMs={endMs}
          onSeek={onSeek}
        />
      )}

      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5">
          <Gauge
            size={12}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <Select
            value={String(speedMultiplier)}
            onValueChange={(v) => onSetSpeed(Number(v))}
            disabled={total === 0}
          >
            <SelectTrigger
              size="sm"
              className="h-7 text-[10px] font-semibold tabular-nums bg-card border-border"
              aria-label="Playback speed"
            >
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border w-auto">
              {speedOpts.map((s) => (
                <SelectItem
                  key={s}
                  value={String(s)}
                  className="text-xs font-semibold tabular-nums"
                >
                  x{s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <TransportBtn
            onClick={onStepBack}
            disabled={cursor === 0 || total === 0}
            aria-label="Previous"
          >
            <SkipBack size={14} />
          </TransportBtn>

          <button
            type="button"
            onClick={onToggle}
            disabled={total === 0}
            className={cn(
              'flex items-center justify-center size-9 rounded-full border-2 transition-colors',
              total === 0
                ? 'opacity-40 cursor-not-allowed border-border'
                : playing
                  ? 'border-primary bg-primary/20 text-primary hover:bg-primary/30'
                  : 'border-border hover:bg-muted',
            )}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>

          <TransportBtn
            onClick={onStepForward}
            disabled={cursor >= total - 1 || total === 0}
            aria-label="Next"
          >
            <SkipForward size={14} />
          </TransportBtn>
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {cursor + 1} / {total}
          </span>
        </div>
      )}
    </div>
  );
}

function TransportBtn({ onClick, disabled, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center size-8 rounded-md border border-border transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted',
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
