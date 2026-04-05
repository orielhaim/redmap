import KpiCards from "@/components/home/kpi-cards";
import FilterBar from "@/components/home/filter-bar";
import TimelineChart from "@/components/home/timeline-chart";
import DistributionCharts from "@/components/home/distribution-charts";
import TopSummary from "@/components/home/top-summary";

export const metadata = {
  title: "Overview - RedMap",
};

export default function HomePage() {
  return (
    <div className="space-y-5">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Israeli emergency alert statistics and analytics
          </p>
        </div>
      </div>

      {/* Filters */}
      <FilterBar />

      {/* KPIs */}
      <KpiCards />

      {/* Timeline */}
      <TimelineChart />

      {/* Distribution charts */}
      <DistributionCharts />

      {/* Top cities / zones / origins */}
      <TopSummary />
    </div>
  );
}
