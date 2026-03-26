import { useState, useMemo } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function Participants() {
  const { participants, selectedEventId, isLoading } = useMockData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');

  const filtered = useMemo(() => {

  const filtered = useMemo(() => {
    return participants
      .filter(p => p.event_id === selectedEventId)
      .filter(p => {
        const q = search.toLowerCase();
        return !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.bib_number.includes(q);
      })
      .filter(p => statusFilter === 'all' || p.status === statusFilter)
      .filter(p => packageFilter === 'all' || p.package_status === packageFilter);
  }, [participants, selectedEventId, search, statusFilter, packageFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Uczestnicy</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Lista uczestników wybranego wydarzenia. Kliknij wiersz, aby zobaczyć szczegóły.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Szukaj po imieniu, email lub numerze..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 sm:h-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="pending">Oczekuje</SelectItem>
              <SelectItem value="checked_in">Odprawiony</SelectItem>
            </SelectContent>
          </Select>
          <Select value={packageFilter} onValueChange={setPackageFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie pakiety</SelectItem>
              <SelectItem value="not_collected">Nie wydany</SelectItem>
              <SelectItem value="collected">Wydany</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">Brak uczestników spełniających kryteria</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Spróbuj zmienić filtry lub wyszukaj inną frazę.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Numer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Pakiet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="cursor-pointer active:bg-accent/50" onClick={() => navigate(`/participants/${p.id}`)}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="block md:hidden text-xs text-muted-foreground truncate">{p.email}</span>
                      <span className="block sm:hidden mt-0.5">
                        <Badge variant={p.package_status === 'collected' ? 'default' : 'outline'} className="text-[9px]">
                          {p.package_status === 'collected' ? 'Pakiet ✓' : 'Pakiet ○'}
                        </Badge>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{p.email}</TableCell>
                  <TableCell className="tabular-nums text-sm">#{p.bib_number}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                      {p.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={p.package_status === 'collected' ? 'default' : 'outline'} className="text-[10px]">
                      {p.package_status === 'collected' ? 'Wydany' : 'Nie wydany'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{filtered.length} uczestników</p>
    </div>
  );
}
