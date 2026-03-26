import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function EventsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3"><Skeleton className="h-5 w-36" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <div className="pt-2">
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
