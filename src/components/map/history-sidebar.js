'use client';

import { useEffect, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar';

const TYPE_LABELS = {
  missiles: 'ירי רקטות וטילים',
  radiologicalEvent: 'אירוע רדיולוגי',
  earthQuake: 'רעידת אדמה',
  tsunami: 'צונאמי',
  hostileAircraftIntrusion: 'חדירת כלי טיס עויין',
  hazardousMaterials: 'חומרים מסוכנים',
  terroristInfiltration: 'חדירת מחבלים',
  newsFlash: 'התרעה מקדימה',
  endAlert: 'הסתיים האירוע',
};

function badgeClass(type) {
  if (type === 'newsFlash')
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (type === 'endAlert')
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  return 'bg-primary/15 text-primary border-primary/30';
}

function dotClass(type) {
  if (type === 'newsFlash') return 'bg-amber-400';
  if (type === 'endAlert') return 'bg-emerald-400';
  return 'bg-primary';
}

function formatTime(ts) {
  try {
    return format(parseISO(ts), 'dd/MM HH:mm');
  } catch {
    return ts;
  }
}

export default function HistorySidebar({
  events,
  cursor,
  playing,
  onSeek,
  loading,
  error,
  onRefetch,
}) {
  const itemRefs = useRef({});

  const displayEvents = useMemo(() => {
    return events.map((ev, idx) => ({ ev, idx })).reverse();
  }, [events]);

  const displayCursor = cursor != null ? events.length - 1 - cursor : null;

  useEffect(() => {
    if (!playing || displayCursor == null) return;
    const el = itemRefs.current[displayCursor];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [displayCursor, playing]);

  return (
    <>
      <SidebarHeader className="flex-row items-center justify-between border-b border-sidebar-border px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider">
          יומן אירועים
        </span>
        {events.length > 0 && (
          <span className="text-xs text-sidebar-foreground/70 tabular-nums">
            {events.length.toLocaleString()} אירועים
          </span>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-sidebar-accent/40 animate-pulse"
              />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <button
              type="button"
              onClick={onRefetch}
              className="text-xs px-3 py-1.5 rounded-md border border-sidebar-border hover:bg-sidebar-accent transition-colors"
            >
              נסה שוב
            </button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs text-sidebar-foreground/70">
            אין אירועים בטווח הזמן הנבחר
          </div>
        )}

        {!loading &&
          !error &&
          displayEvents.map(({ ev, idx }, di) => {
            const isActive = cursor != null && idx === cursor;
            const cityCount = (ev.cities ?? []).length;
            const isMerged = ev._merged;

            return (
              <button
                key={ev.id ?? idx}
                ref={(el) => {
                  itemRefs.current[di] = el;
                }}
                type="button"
                onClick={() => onSeek(idx)}
                className={cn(
                  'w-full text-right px-3 py-2.5 border-b border-sidebar-border/40 transition-colors',
                  isActive
                    ? 'bg-sidebar-accent/50 border-s-2 border-s-primary'
                    : 'hover:bg-sidebar-accent/30',
                )}
                dir="rtl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col items-start gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'size-1.5 rounded-full shrink-0 mt-px',
                          dotClass(ev.type),
                        )}
                      />
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                          badgeClass(ev.type),
                        )}
                      >
                        {TYPE_LABELS[ev.type] ?? ev.type}
                      </span>
                      {isMerged && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-violet-500/15 text-violet-400 border-violet-500/30">
                          {ev._mergedCount} מוזגו
                        </span>
                      )}
                    </div>

                    {cityCount > 0 && (
                      <div className="flex flex-wrap gap-1" dir="rtl">
                        {(ev.cities ?? []).slice(0, 8).map((c) => (
                          <span
                            key={c.id ?? c.name}
                            className="text-[10px] text-sidebar-foreground/70 bg-sidebar-accent/40 px-1.5 py-px rounded"
                          >
                            {c.name}
                          </span>
                        ))}
                        {cityCount > 8 && (
                          <span className="text-[10px] text-sidebar-foreground/70">
                            +{cityCount - 8}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-0.5 pt-0.5">
                    <span className="text-[10px] text-sidebar-foreground/70 tabular-nums whitespace-nowrap">
                      {formatTime(ev.timestamp)}
                    </span>
                    {isMerged && ev._mergedLastTimestamp && (
                      <span className="text-[9px] text-sidebar-foreground/50 tabular-nums whitespace-nowrap">
                        עד {formatTime(ev._mergedLastTimestamp)}
                      </span>
                    )}
                    {ev.origin && (
                      <span className="text-[9px] text-sidebar-foreground/50 uppercase tracking-wide">
                        {ev.origin}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </SidebarContent>
    </>
  );
}
