import { useState, useMemo } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function Participants() {
  const { participants, selectedEventId } = useMockData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');

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
      <h1 className="text-2xl font-bold tracking-tight">Uczestnicy</h1>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Szukaj po imieniu, email lub numerze..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            <SelectItem value="pending">Oczekuje</SelectItem>
            <SelectItem value="checked_in">Odprawiony</SelectItem>
          </SelectContent>
        </Select>
        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie pakiety</SelectItem>
            <SelectItem value="not_collected">Nie wydany</SelectItem>
            <SelectItem value="collected">Wydany</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Brak uczestników spełniających kryteria</div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Numer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pakiet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/participants/${p.id}`)}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="tabular-nums">#{p.bib_number}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                      {p.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
