import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function ScannerSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-0">
        <Skeleton className="h-7 w-20" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-7 w-14 rounded-md" />
        </div>
      </div>
      <div className="px-4 md:px-0">
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
      <div className="px-4 md:px-0">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      </div>
      <div className="px-4 md:px-0">
        <Card>
          <CardContent className="py-3 space-y-2">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
