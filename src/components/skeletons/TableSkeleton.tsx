import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  title?: string;
  subtitle?: string;
  showFilters?: boolean;
}

export default function TableSkeleton({ rows = 6, cols = 4, title, subtitle, showFilters }: TableSkeletonProps) {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-36" />
        {subtitle !== undefined && <Skeleton className="h-4 w-72 mt-2" />}
      </div>
      {showFilters && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full rounded-md" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-full sm:w-[160px] rounded-md" />
            <Skeleton className="h-10 w-full sm:w-[160px] rounded-md" />
          </div>
        </div>
      )}
      <div className="surface-table overflow-hidden rounded-[1.35rem] border">
        <div className="flex gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 rounded-full bg-white/10" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-white/[0.06] px-5 py-4 last:border-0 sm:px-6 sm:py-5">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1 rounded-full bg-white/10" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
