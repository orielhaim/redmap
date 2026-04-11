import { TrendingUp } from "lucide-react";

export const metadata = {
  title: "Prediction - Radar",
};

export default function PredictionPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="flex items-center justify-center size-16 rounded-2xl bg-muted border border-border">
        <TrendingUp size={28} className="text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Coming soon...
        </h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          AI-powered alert prediction and forecasting is under development.
        </p>
      </div>
    </div>
  );
}
