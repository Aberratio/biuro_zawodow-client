import { useEffect, useMemo, useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { ParticipantFieldMapping } from '@/types';

export default function Participants() {
  const {
    participants,
    selectedEventId,
    isLoading,
    getParticipantFieldMappings,
    addParticipantManually,
  } = useMockData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualSaving, setManualSaving] = useState(false);

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === selectedEventId),
    [participants, selectedEventId]
  );

  const filtered = useMemo(() => {
    return eventParticipants
      .filter(participant => {
        const query = search.toLowerCase();
        return !query
          || participant.name.toLowerCase().includes(query)
          || participant.email.toLowerCase().includes(query)
          || participant.bib_number.includes(query);
      })
      .filter(participant => statusFilter === 'all' || participant.status === statusFilter)
      .filter(participant => packageFilter === 'all' || participant.package_status === packageFilter);
  }, [eventParticipants, packageFilter, search, statusFilter]);

  useEffect(() => {
    if (!selectedEventId) {
      setMappings([]);
      setManualFields({});
      return;
    }

    void getParticipantFieldMappings(selectedEventId)
      .then(data => {
        setMappings(data);
        setManualFields(
          data
            .filter(mapping => mapping.is_active && mapping.field_role !== 'email')
            .reduce<Record<string, string>>((acc, mapping) => {
              acc[mapping.alias] = '';
              return acc;
            }, {})
        );
      })
      .catch(() => {
        setMappings([]);
        setManualFields({});
      });
  }, [getParticipantFieldMappings, selectedEventId]);

  const activeMappings = useMemo(
    () => mappings.filter(mapping => mapping.is_active && mapping.field_role !== 'email'),
    [mappings]
  );
  const canAddManually = eventParticipants.length > 0 && mappings.length > 0;

  const handleManualFieldChange = (alias: string, value: string) => {
    setManualFields(prev => ({ ...prev, [alias]: value }));
  };

  const handleManualSubmit = async () => {
    setManualSaving(true);
    const result = await addParticipantManually(selectedEventId, manualEmail, manualFields);
    setManualSaving(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się dodać uczestnika',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setManualOpen(false);
    setManualEmail('');
    setManualFields(prev => Object.keys(prev).reduce<Record<string, string>>((acc, key) => {
      acc[key] = '';
      return acc;
    }, {}));
    toast({ title: 'Dodano uczestnika ręcznie' });
  };

  if (isLoading) return <TableSkeleton rows={8} cols={4} subtitle="" showFilters />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Uczestnicy</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Lista uczestników wybranego wydarzenia. Kliknij wiersz, aby zobaczyć szczegóły.
          </p>
        </div>
        {canAddManually && (
          <Button onClick={() => setManualOpen(true)} className="h-11 sm:h-10">
            <UserPlus className="h-4 w-4 mr-1" /> Dodaj ręcznie
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po imieniu, email lub numerze..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="pl-9 h-11 sm:h-10"
          />
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
              {filtered.map(participant => (
                <TableRow
                  key={participant.id}
                  className="cursor-pointer active:bg-accent/50"
                  onClick={() => navigate(`/participants/${participant.id}`)}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{participant.name}</span>
                      <span className="block md:hidden text-xs text-muted-foreground truncate">{participant.email}</span>
                      <span className="block sm:hidden mt-0.5">
                        <Badge variant={participant.package_status === 'collected' ? 'default' : 'outline'} className="text-[9px]">
                          {participant.package_status === 'collected' ? 'Pakiet ✓' : 'Pakiet ○'}
                        </Badge>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{participant.email}</TableCell>
                  <TableCell className="tabular-nums text-sm">#{participant.bib_number}</TableCell>
                  <TableCell>
                    <Badge variant={participant.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                      {participant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={participant.package_status === 'collected' ? 'default' : 'outline'} className="text-[10px]">
                      {participant.package_status === 'collected' ? 'Wydany' : 'Nie wydany'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{filtered.length} uczestników</p>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Dodaj uczestnika ręcznie</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={manualEmail} onChange={event => setManualEmail(event.target.value)} className="mt-2" />
            </div>
            {activeMappings.map(mapping => (
              <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                <Label>{mapping.alias}</Label>
                <Input
                  value={manualFields[mapping.alias] ?? ''}
                  onChange={event => handleManualFieldChange(mapping.alias, event.target.value)}
                  className="mt-2"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button onClick={handleManualSubmit} disabled={manualSaving}>
              {manualSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zapisz uczestnika
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
