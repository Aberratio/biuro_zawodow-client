import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function Organizations() {
  const { organizations, events, users, isLoading } = useMockData();

  if (isLoading) return <TableSkeleton rows={4} cols={2} subtitle="" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Organizacje</h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Przegląd wszystkich organizacji w systemie, ich wydarzeń i użytkowników.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {organizations.map(org => {
          const orgEvents = events.filter(e => e.organization_id === org.id);
          const orgUsers = users.filter(u => u.organization_id === org.id);
          return (
            <Card key={org.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base sm:text-lg">{org.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{orgEvents.length} wydarzeń</Badge>
                  <Badge variant="outline">{orgUsers.length} użytkowników</Badge>
                </div>
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Wydarzenie</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgEvents.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm py-1.5">{e.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground py-1.5">{e.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
