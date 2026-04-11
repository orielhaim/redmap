"use client";

import { useDashboardStore } from "@/stores/dashboard-store";
import { useApi } from "@/hooks/use-api";
import { getSummary } from "@/lib/api/siren";
import { SectionCard, CardError, CardEmpty } from "./section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Layers } from "lucide-react";

function RankBar({ count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-primary/70 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TopList({ items, max, labelKey, subKey }) {
  if (!items?.length) return <CardEmpty message="No data" />;
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-4 tabular-nums text-right shrink-0">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-medium truncate">
                {item[labelKey]}
              </span>
              <span className="text-xs font-semibold tabular-nums text-primary shrink-0">
                {item.count?.toLocaleString()}
              </span>
            </div>
            {subKey && (
              <p className="text-xs text-muted-foreground truncate mb-1.5">
                {item[subKey]}
              </p>
            )}
            <RankBar count={item.count} max={max} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TopSummary() {
  const { filters } = useDashboardStore();

  const { data, loading, error, refetch } = useApi(
    () =>
      getSummary({
        startDate: filters.startDate,
        endDate: filters.endDate,
        origin: filters.origin,
        include: "topCities,topZones,topOrigins",
        topLimit: 10,
      }),
    [filters.startDate, filters.endDate, filters.origin]
  );

  const maxCity = data?.topCities?.[0]?.count ?? 0;
  const maxZone = data?.topZones?.[0]?.count ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard
        title="Top Cities"
        description="Most targeted cities"
        actions={<MapPin size={14} className="text-muted-foreground" />}
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <CardError message={error} onRetry={refetch} />
        ) : (
          <TopList
            items={data?.topCities}
            max={maxCity}
            labelKey="city"
            subKey="zone"
          />
        )}
      </SectionCard>

      <SectionCard
        title="Top Zones"
        description="Most affected zones"
        actions={<Layers size={14} className="text-muted-foreground" />}
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <CardError message={error} onRetry={refetch} />
        ) : (
          <TopList items={data?.topZones} max={maxZone} labelKey="zone" />
        )}
      </SectionCard>
    </div>
  );
}
