import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col items-center gap-1 pt-4 sm:pt-6 pb-4 sm:pb-6 px-2 sm:px-6">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
              <Skeleton className="h-7 w-12 mt-1" />
              <Skeleton className="h-3 w-16 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded-full mt-0.5" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
