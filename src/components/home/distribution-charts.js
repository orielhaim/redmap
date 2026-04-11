'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useApi } from '@/hooks/use-api';
import { getDistribution } from '@/lib/api/siren';
import { SectionCard, CardError, CardEmpty } from './section-card';
import { Skeleton } from '@/components/ui/skeleton';

const CHART_COLORS = [
  'oklch(0.63 0.23 22)',
  'oklch(0.72 0.18 50)',
  'oklch(0.65 0.15 200)',
  'oklch(0.58 0.18 280)',
  'oklch(0.70 0.15 130)',
  'oklch(0.60 0.20 330)',
];

const ALERT_LABELS = {
  missiles: 'Missiles',
  radiologicalEvent: 'Radiological',
  earthQuake: 'Earthquake',
  tsunami: 'Tsunami',
  hostileAircraftIntrusion: 'Aircraft',
  hazardousMaterials: 'Hazmat',
  terroristInfiltration: 'Infiltration',
};

const HIDDEN_CATEGORIES = new Set(['newsFlash', 'endAlert']);

function labelFor(key) {
  if (!key) return 'Unknown';
  return ALERT_LABELS[key] ?? key;
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{labelFor(label)}</p>
      <p className="font-semibold text-foreground">
        {payload[0]?.value?.toLocaleString()} alerts
      </p>
    </div>
  );
}

function DistributionBar({ groupBy }) {
  const { filters } = useDashboardStore();

  const { data, loading, error, refetch } = useApi(
    () =>
      getDistribution({
        startDate: filters.startDate,
        endDate: filters.endDate,
        origin: filters.origin,
        groupBy,
        limit: 10,
      }),
    [filters.startDate, filters.endDate, filters.origin, groupBy],
  );

  const chartData = useMemo(() => {
    const items =
      data?.data?.filter(
        (item) => groupBy !== 'category' || !HIDDEN_CATEGORIES.has(item.label),
      ) ?? [];

    // Merge rows whose label normalises to the same display name
    const merged = new Map();

    for (const item of items) {
      const display = labelFor(item.label); // null / "" / "Unknown" → "Unknown"
      const existing = merged.get(display);
      if (existing) {
        existing.count += item.count;
      } else {
        merged.set(display, {
          label: item.label,
          displayLabel: display,
          count: item.count,
        });
      }
    }

    return Array.from(merged.values());
  }, [data, groupBy]);

  return (
    <SectionCard
      title={groupBy === 'category' ? 'By Alert Type' : 'By Origin'}
      description={`Alert distribution grouped by ${groupBy}`}
    >
      {loading ? (
        <Skeleton className="w-full h-52 rounded-lg" />
      ) : error ? (
        <CardError message={error} onRetry={refetch} />
      ) : chartData.length === 0 ? (
        <CardEmpty message="No distribution data" />
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 5%)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 240)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              dataKey="displayLabel"
              type="category"
              tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 240)' }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.label}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

export default function DistributionCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DistributionBar groupBy="category" />
      <DistributionBar groupBy="origin" />
    </div>
  );
}
