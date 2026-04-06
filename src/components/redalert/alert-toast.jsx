'use client';

import { toast as sonnerToast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { XIcon } from 'lucide-react';

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

function badgeColorClass(type) {
  if (type === 'newsFlash')
    return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400';
  if (type === 'endAlert')
    return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
  return 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400';
}

function formatTime(ts) {
  try {
    return format(parseISO(ts), 'HH:mm:ss');
  } catch {
    return '';
  }
}

function buildDescription(ev) {
  const cities = ev.cities ?? [];
  const MAX = 4;
  const shown = cities
    .slice(0, MAX)
    .map((c) => (typeof c === 'string' ? c : c.name))
    .filter(Boolean)
    .join(', ');
  const extra = cities.length > MAX ? ` +${cities.length - MAX}` : '';
  return shown ? shown + extra : null;
}

export function showAlertToast(ev, onOpenMap) {
  const typeLabel = TYPE_LABELS[ev.type] ?? ev.type;
  const description = buildDescription(ev);
  const time = formatTime(ev.timestamp);

  sonnerToast.custom(
    (id) => (
      <AlertToast
        type={ev.type}
        typeLabel={typeLabel}
        description={description}
        time={time}
        onOpenMap={() => {
          sonnerToast.dismiss(id);
          onOpenMap?.();
        }}
        onDismiss={() => sonnerToast.dismiss(id)}
      />
    ),
    { duration: 12000 },
  );
}

function AlertToast({
  type,
  typeLabel,
  description,
  time,
  onOpenMap,
  onDismiss,
}) {
  return (
    <div
      dir="rtl"
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-popover p-3.5 shadow-lg md:max-w-[380px]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeColorClass(type)}`}
          >
            {typeLabel}
          </span>
          {time && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {time}
            </span>
          )}
        </div>

        {description && (
          <p className="mt-1 text-xs text-muted-foreground leading-snug">
            {description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 items-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          <XIcon className="size-3" />
        </button>
        <button
          type="button"
          onClick={onOpenMap}
          className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          פתח במפה
        </button>
      </div>
    </div>
  );
}
