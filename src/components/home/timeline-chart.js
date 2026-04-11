'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useApi } from '@/hooks/use-api';
import { getSummary } from '@/lib/api/siren';
import { SectionCard, CardError, CardEmpty } from './section-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const GROUP_OPTIONS = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-foreground">
        {payload[0]?.value?.toLocaleString()} alerts
      </p>
    </div>
  );
}

function formatPeriod(period, group) {
  try {
    if (group === 'hour') return format(parseISO(period), 'MMM d HH:mm');
    if (group === 'day') return format(parseISO(period), 'MMM d');
    if (group === 'week')
      return `W${format(parseISO(period), 'ww')} '${format(parseISO(period), 'yy')}`;
    if (group === 'month') return format(parseISO(period), 'MMM yyyy');
    return period;
  } catch {
    return period;
  }
}

export default function TimelineChart() {
  const { filters, timelineGroup, setTimelineGroup } = useDashboardStore();

  const { data, loading, error, refetch } = useApi(
    () =>
      getSummary({
        startDate: filters.startDate,
        endDate: filters.endDate,
        origin: filters.origin,
        include: 'timeline',
        timelineGroup,
      }),
    [filters.startDate, filters.endDate, filters.origin, timelineGroup],
  );

  const chartData =
    data?.timeline?.map((item) => ({
      period: formatPeriod(item.period, timelineGroup),
      raw: item.period,
      count: item.count,
    })) ?? [];

  return (
    <SectionCard
      title="Alert Timeline"
      description="Alert count over time"
      actions={
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimelineGroup(opt.value)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
                timelineGroup === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <Skeleton className="w-full h-52 rounded-lg" />
      ) : error ? (
        <CardError message={error} onRetry={refetch} />
      ) : chartData.length === 0 ? (
        <CardEmpty message="No timeline data for this period" />
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.63 0.23 22)"
                  stopOpacity={0.25}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.63 0.23 22)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 5%)"
              vertical={false}
            />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 240)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 240)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="oklch(0.63 0.23 22)"
              strokeWidth={2}
              fill="url(#alertGrad)"
              dot={false}
              activeDot={{ r: 4, fill: 'oklch(0.63 0.23 22)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
