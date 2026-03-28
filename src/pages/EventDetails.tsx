import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, CheckCircle, Package, ScanLine, MapPin, Calendar, ArrowLeft, FileUp, UserPlus, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import { ParticipantFieldMapping } from '@/types';

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    events,
    participants,
    setSelectedEventId,
    isLoading,
    getParticipantFieldMappings,
    addParticipantManually,
  } = useMockData();
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualSaving, setManualSaving] = useState(false);

  const event = events.find(e => e.id === id);
  const ep = participants.filter(p => p.event_id === id);
  const checkedIn = ep.filter(p => p.status === 'checked_in').length;
  const collected = ep.filter(p => p.package_status === 'collected').length;

  const activeMappings = useMemo(
    () => mappings.filter(mapping => mapping.is_active && mapping.field_role !== 'email'),
    [mappings]
  );

  useEffect(() => {
    if (!id) return;

    setMappingsLoading(true);
    getParticipantFieldMappings(id)
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
      })
      .finally(() => setMappingsLoading(false));
  }, [getParticipantFieldMappings, id]);

  if (isLoading) return <DetailSkeleton />;
  if (!event) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono wydarzenia</div>;

  const hasSavedMapping = mappings.length > 0;

  const handleManualFieldChange = (alias: string, value: string) => {
    setManualFields(prev => ({ ...prev, [alias]: value }));
  };

  const handleManualSubmit = async () => {
    setManualSaving(true);
    const result = await addParticipantManually(event.id, manualEmail, manualFields);
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

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/events')} className="touch-manipulation">
        <ArrowLeft className="h-4 w-4 mr-1" /> Wróć
      </Button>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{event.name}</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{event.date}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 sm:gap-4 pt-4 sm:pt-6 pb-4 sm:pb-6 px-3 sm:px-6">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold tabular-nums">{ep.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Uczestnicy</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 sm:gap-4 pt-4 sm:pt-6 pb-4 sm:pb-6 px-3 sm:px-6">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold tabular-nums">{checkedIn}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Odprawieni</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 sm:gap-4 pt-4 sm:pt-6 pb-4 sm:pb-6 px-3 sm:px-6">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold tabular-nums">{collected}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Pakiety</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => { setSelectedEventId(event.id); navigate('/scanner'); }} className="h-11 sm:h-10 touch-manipulation">
          <ScanLine className="h-4 w-4 mr-1" /> Otwórz skaner
        </Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/participants'); }} className="h-11 sm:h-10 touch-manipulation">
          <Users className="h-4 w-4 mr-1" /> Uczestnicy
        </Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate(`/events/${event.id}/import`); }} className="h-11 sm:h-10 touch-manipulation">
          <FileUp className="h-4 w-4 mr-1" /> Importuj CSV
        </Button>
        {hasSavedMapping && (
          <Button variant="outline" onClick={() => setManualOpen(true)} className="h-11 sm:h-10 touch-manipulation">
            <UserPlus className="h-4 w-4 mr-1" /> Dodaj ręcznie
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapowanie pól uczestnika</CardTitle>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie mapowania...</p>
          ) : hasSavedMapping ? (
            <div className="flex flex-wrap gap-2">
              {mappings.map(mapping => (
                <Badge key={`${mapping.source_column_name}-${mapping.alias}`} variant="outline">
                  {mapping.alias} ({mapping.field_role})
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              To wydarzenie nie ma jeszcze zapisanego mapowania CSV. Po pierwszym imporcie pojawi się też ręczne dodawanie uczestników.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Uczestnicy</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ep.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2.5 text-sm border-b last:border-0 cursor-pointer hover:bg-accent/30 active:bg-accent/50 px-2 rounded touch-manipulation" onClick={() => navigate(`/participants/${p.id}`)}>
                <div className="min-w-0 mr-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground ml-2 tabular-nums">#{p.bib_number}</span>
                </div>
                <Badge variant={p.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                  {p.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                </Badge>
              </div>
            ))}
            {ep.length > 10 && <p className="text-xs text-muted-foreground text-center pt-2">...i {ep.length - 10} więcej</p>}
            {ep.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Brak uczestników. Zaimportuj listę z CSV.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Dodaj uczestnika ręcznie</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={manualEmail} onChange={eventValue => setManualEmail(eventValue.target.value)} className="mt-2" />
            </div>
            {activeMappings.map(mapping => (
              <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                <Label>{mapping.alias}</Label>
                <Input
                  value={manualFields[mapping.alias] ?? ''}
                  onChange={eventValue => handleManualFieldChange(mapping.alias, eventValue.target.value)}
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
