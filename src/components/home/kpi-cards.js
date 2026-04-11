'use client';

import { motion } from 'motion/react';
import {
  Activity,
  Clock,
  MapPin,
  Layers,
  Globe,
  Zap,
} from 'lucide-react';
import { CalendarDaysIcon } from '@/components/ui/calendar-days';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useApi } from '@/hooks/use-api';
import { getSummary } from '@/lib/api/siren';
import { CardError } from './section-card';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

function KpiCard({ label, value, icon: Icon, accent, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'relative rounded-xl border border-border bg-card p-4 overflow-hidden',
        'hover:border-border/80 transition-colors',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {value !== null && value !== undefined
              ? value.toLocaleString()
              : '-'}
          </p>
        </div>
        <div
          className={cn(
            'flex items-center justify-center size-8 rounded-lg',
            accent
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon size={15} />
        </div>
      </div>
      {accent && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0" />
      )}
    </motion.div>
  );
}

function formatPeakPeriod(period) {
  try {
    const d = parseISO(period);
    if (!isValid(d)) return period;
    return format(d, 'MMM d, yyyy · HH:mm');
  } catch {
    return period;
  }
}

function timeAgo(period) {
  try {
    const d = parseISO(period);
    if (!isValid(d)) return null;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return null;
  }
}

function PeakPeriod({ period, count }) {
  const readable = formatPeakPeriod(period);
  const ago = timeAgo(period);

  return (
    <p className="text-xs text-muted-foreground px-1">
      Peak period:{' '}
      <Tooltip>
        <TooltipTrigger>
          <span className="text-foreground font-medium cursor-default underline decoration-dashed decoration-muted-foreground/40 underline-offset-2">
            {readable}
          </span>
        </TooltipTrigger>
        {ago && <TooltipContent>{ago}</TooltipContent>}
      </Tooltip>
      {' - '}
      <span className="text-primary font-semibold">
        {count?.toLocaleString()}
      </span>{' '}
      alerts
    </p>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {['range', '24h', '7d', '30d', 'cities', 'zones', 'origins'].map((k) => (
        <div key={k} className="rounded-xl border border-border bg-card p-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KpiCards() {
  const { filters } = useDashboardStore();

  const { data, loading, error, refetch } = useApi(
    () =>
      getSummary({
        startDate: filters.startDate,
        endDate: filters.endDate,
        origin: filters.origin,
        include: 'peak',
      }),
    [filters.startDate, filters.endDate, filters.origin],
  );

  if (loading) return <KpiSkeleton />;
  if (error)
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <CardError message={error} onRetry={refetch} />
      </div>
    );
  if (!data) return null;

  const { totals, uniqueCities, uniqueZones, uniqueOrigins, peak } = data;

  const cards = [
    { label: 'In Range', value: totals?.range, icon: CalendarDaysIcon, accent: true },
    { label: 'Last 24h', value: totals?.last24h, icon: Clock, accent: false },
    { label: 'Last 7d', value: totals?.last7d, icon: Activity, accent: false },
    { label: 'Last 30d', value: totals?.last30d, icon: Zap, accent: false },
    {
      label: 'Unique Cities',
      value: uniqueCities,
      icon: MapPin,
      accent: false,
    },
    { label: 'Unique Zones', value: uniqueZones, icon: Layers, accent: false },
    {
      label: 'Unique Origins',
      value: uniqueOrigins,
      icon: Globe,
      accent: false,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((card, i) => (
          <KpiCard key={card.label} {...card} index={i} />
        ))}
      </div>
      {peak?.period && <PeakPeriod period={peak.period} count={peak.count} />}
    </div>
  );
}
