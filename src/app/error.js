"use client";

import { AlertCircle } from "lucide-react";

export default function DashboardError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="flex items-center justify-center size-12 rounded-2xl bg-destructive/10 border border-destructive/20">
        <AlertCircle size={22} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {error?.message ?? "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
