import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, CheckCircle, ScanLine, MapPin, Calendar, ArrowLeft, FileUp, UserPlus, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import { ParticipantFieldMapping, User } from '@/types';
import { formatEventOfficeWindow } from '@/lib/events';
import { buildEmptyParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { getParticipantStatusDefinition, participantCountsAsCheckedIn } from '@/lib/participant-status';

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    events,
    participants,
    users,
    currentRole,
    currentUser,
    setSelectedEventId,
    isLoading,
    getParticipantFieldMappings,
    addParticipantManually,
    assignScannerEvents,
  } = useMockData();
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [scannerSelection, setScannerSelection] = useState<string[]>([]);
  const [scannerSaving, setScannerSaving] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualSaving, setManualSaving] = useState(false);

  const event = events.find(entry => entry.id === id);
  const eventParticipants = participants.filter(participant => participant.event_id === id);
  const checkedIn = eventParticipants.filter(participantCountsAsCheckedIn).length;

  const activeMappings = useMemo(() => getActiveParticipantMappings(mappings), [mappings]);
  const organizationScanners = useMemo(
    () => users.filter(user => user.role === 'scanner' && user.organization_id === event?.organization_id),
    [event?.organization_id, users],
  );
  const assignedScanners = useMemo(
    () => organizationScanners.filter(scanner => scanner.assigned_events.includes(event?.id ?? '')),
    [event?.id, organizationScanners],
  );
  const canManageScanners = useMemo(() => {
    if (!event) return false;
    if (currentRole === 'superadmin') return true;
    if (currentRole === 'admin') return (currentUser.organization_ids ?? []).includes(event.organization_id);
    if (currentRole === 'editor') return currentUser.organization_id === event.organization_id;
    return false;
  }, [currentRole, currentUser, event]);

  useEffect(() => {
    if (id) {
      setSelectedEventId(id);
    }
  }, [id, setSelectedEventId]);

  useEffect(() => {
    if (!id) return;

    setMappingsLoading(true);
    getParticipantFieldMappings(id)
      .then(data => {
        setMappings(data);
        setManualFields(buildEmptyParticipantFieldValues(data));
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
    setManualFields(previous => ({ ...previous, [alias]: value }));
  };

  const toggleScannerSelection = (scannerId: string, checked: boolean) => {
    setScannerSelection(previous => (
      checked ? [...previous, scannerId] : previous.filter(idValue => idValue !== scannerId)
    ));
  };

  const openScannerDialog = () => {
    setScannerSelection(assignedScanners.map(scanner => scanner.id));
    setScannerDialogOpen(true);
  };

  const handleSaveScannerAssignments = async () => {
    if (!event) return;

    const selectedScannerIds = new Set(scannerSelection);
    const changedScanners = organizationScanners.filter(scanner => {
      const wasAssigned = scanner.assigned_events.includes(event.id);
      const shouldBeAssigned = selectedScannerIds.has(scanner.id);
      return wasAssigned !== shouldBeAssigned;
    });

    if (changedScanners.length === 0) {
      setScannerDialogOpen(false);
      return;
    }

    setScannerSaving(true);
    try {
      for (const scanner of changedScanners) {
        const shouldBeAssigned = selectedScannerIds.has(scanner.id);
        const nextAssignedEvents = shouldBeAssigned
          ? [...new Set([...scanner.assigned_events, event.id])]
          : scanner.assigned_events.filter(assignedEventId => assignedEventId !== event.id);

        const result = await assignScannerEvents(scanner.id, nextAssignedEvents);
        if (!result.ok) {
          toast({
            title: 'Nie udalo sie zapisac przypisan skanerow',
            description: result.error ?? `Nie udalo sie zaktualizowac skanera ${scanner.name}.`,
            variant: 'destructive',
          });
          return;
        }
      }

      setScannerDialogOpen(false);
      toast({ title: 'Zapisano przypisania skanerow' });
    } finally {
      setScannerSaving(false);
    }
  };

  const handleManualSubmit = async () => {
    setManualSaving(true);
    const result = await addParticipantManually(event.id, manualEmail, manualFields);
    setManualSaving(false);

    if (!result.ok) {
      toast({
        title: 'Nie udalo sie dodac uczestnika',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setManualOpen(false);
    setManualEmail('');
    setManualFields(buildEmptyParticipantFieldValues(mappings));
    toast({ title: 'Dodano uczestnika recznie' });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/events')} className="touch-manipulation">
        <ArrowLeft className="h-4 w-4 mr-1" /> Wroc
      </Button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{event.name}</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{event.date}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Biuro: {formatEventOfficeWindow(event)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 sm:gap-4 pt-4 sm:pt-6 pb-4 sm:pb-6 px-3 sm:px-6">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold tabular-nums">{eventParticipants.length}</p>
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
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Skanerzy wydarzenia</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Skanerzy z organizacji przypisani bezposrednio do tego wydarzenia.
            </p>
          </div>
          {canManageScanners && (
            <Button variant="outline" size="sm" onClick={openScannerDialog}>
              Zarzadzaj skanerami
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {organizationScanners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak skanerow w organizacji tego wydarzenia.</p>
          ) : assignedScanners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Do tego wydarzenia nie przypisano jeszcze zadnego skanera.</p>
          ) : (
            <div className="space-y-2">
              {assignedScanners.map((scanner: User) => (
                <div key={scanner.id} className="rounded-xl border px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{scanner.name}</div>
                      <div className="text-xs text-muted-foreground">{scanner.email}</div>
                    </div>
                    <Badge variant="default">Przypisany</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => { setSelectedEventId(event.id); navigate('/scanner'); }} className="h-11 sm:h-10 touch-manipulation">
          <ScanLine className="h-4 w-4 mr-1" /> Otworz skaner
        </Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/participants'); }} className="h-11 sm:h-10 touch-manipulation">
          <Users className="h-4 w-4 mr-1" /> Uczestnicy
        </Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate(`/events/${event.id}/import`); }} className="h-11 sm:h-10 touch-manipulation">
          <FileUp className="h-4 w-4 mr-1" /> Importuj CSV
        </Button>
        {hasSavedMapping && (
          <Button variant="outline" onClick={() => setManualOpen(true)} className="h-11 sm:h-10 touch-manipulation">
            <UserPlus className="h-4 w-4 mr-1" /> Dodaj recznie
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapowanie pol uczestnika</CardTitle>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <p className="text-sm text-muted-foreground">Ladowanie mapowania...</p>
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
              To wydarzenie nie ma jeszcze zapisanego mapowania CSV. Po pierwszym imporcie pojawi sie tez reczne dodawanie uczestnikow.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Uczestnicy</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {eventParticipants.slice(0, 10).map(participant => {
              const status = getParticipantStatusDefinition(participant.status);

              return (
                <div
                  key={participant.id}
                  className="flex items-center justify-between py-2.5 text-sm border-b last:border-0 cursor-pointer hover:bg-accent/30 active:bg-accent/50 px-2 rounded touch-manipulation"
                  onClick={() => navigate(`/participants/${participant.id}`)}
                >
                  <div className="min-w-0 mr-2">
                    <span className="font-medium">{participant.name}</span>
                    <span className="text-muted-foreground ml-2 tabular-nums">#{participant.bib_number}</span>
                  </div>
                  <Badge variant={status.badgeVariant} className="text-[10px] shrink-0">
                    {status.shortLabel}
                  </Badge>
                </div>
              );
            })}
            {eventParticipants.length > 10 && <p className="text-xs text-muted-foreground text-center pt-2">...i {eventParticipants.length - 10} wiecej</p>}
            {eventParticipants.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Brak uczestnikow. Zaimportuj liste z CSV.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Dodaj uczestnika recznie</DialogTitle>
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

      <Dialog open={scannerDialogOpen} onOpenChange={setScannerDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Przypisz skanerow do wydarzenia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {organizationScanners.length > 0 ? (
              <div className="space-y-2 rounded-xl border p-3">
                {organizationScanners.map(scanner => (
                  <label key={scanner.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={scannerSelection.includes(scanner.id)} onCheckedChange={checked => toggleScannerSelection(scanner.id, checked === true)} />
                    <span>{scanner.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Brak skanerow w organizacji tego wydarzenia.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveScannerAssignments} disabled={scannerSaving || organizationScanners.length === 0}>
              {scannerSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz przypisania
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
