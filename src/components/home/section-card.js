'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card overflow-hidden',
        className,
      )}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 p-4 pb-3 border-b border-border/50">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function CardSkeleton({ rows = 3, height = 200 }) {
  return (
    <div className="space-y-2">
      <Skeleton style={{ height }} className="w-full rounded-lg" />
    </div>
  );
}

export function CardError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertCircle size={22} className="text-destructive/70" />
      <div>
        <p className="text-sm font-medium text-foreground">Failed to load</p>
        {message && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {message}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      )}
    </div>
  );
}

export function CardEmpty({ message = 'No data available' }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
