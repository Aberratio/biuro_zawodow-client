import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, CheckCircle, ScanLine, MapPin, Calendar, ArrowLeft, FileUp, UserPlus, Loader2, Pencil, Download, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import { ParticipantFieldMapping, User } from '@/types';
import { formatEventOfficeWindow, isValidEventOfficeRange } from '@/lib/events';
import { buildEmptyParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';

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
    updateEvent,
    deleteEvent,
    exportEventCsv,
    exportEventLogsCsv,
  } = useData();
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [scannerSelection, setScannerSelection] = useState<string[]>([]);
  const [scannerSaving, setScannerSaving] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualSaving, setManualSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingLogsCsv, setExportingLogsCsv] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    location: '',
    office_open_at: '',
    office_close_at: '',
  });

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
  const canEditEvent = canManageScanners;
  const canViewParticipantMappings = currentRole === 'superadmin';

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

  useEffect(() => {
    if (!event) return;

    setEditForm({
      name: event.name,
      location: event.location,
      office_open_at: event.office_open_at.slice(0, 16),
      office_close_at: event.office_close_at.slice(0, 16),
    });
  }, [event]);

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
            title: 'Nie udało się zapisać przypisań skanerów',
            description: result.error ?? `Nie udało się zaktualizować skanera ${scanner.name}.`,
            variant: 'destructive',
          });
          return;
        }
      }

      setScannerDialogOpen(false);
      toast({ title: 'Zapisano przypisania skanerów' });
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
        title: 'Nie udało się dodać uczestnika',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setManualOpen(false);
    setManualEmail('');
    setManualFields(buildEmptyParticipantFieldValues(mappings));
    toast({ title: 'Dodano uczestnika ręcznie' });
  };

  const handleEditSubmit = async () => {
    if (!event) return;
    if (!editForm.name || !editForm.location) return;
    if (!editForm.office_open_at || !editForm.office_close_at || !isValidEventOfficeRange(editForm.office_open_at, editForm.office_close_at)) {
      toast({
        title: 'Nieprawidłowe godziny biura',
        description: 'Podaj poprawną datę i godzinę otwarcia oraz zamknięcia biura zawodów.',
        variant: 'destructive',
      });
      return;
    }

    setEditSaving(true);
    const result = await updateEvent(event.id, {
      name: editForm.name,
      location: editForm.location,
      organization_id: event.organization_id,
      office_open_at: editForm.office_open_at,
      office_close_at: editForm.office_close_at,
    });
    setEditSaving(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się zaktualizować wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setEditOpen(false);
    toast({ title: 'Zaktualizowano wydarzenie' });
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    const result = await exportEventCsv(event.id);
    setExportingCsv(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się wyeksportować CSV',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Eksport CSV rozpoczęty' });
  };

  const handleExportLogsCsv = async () => {
    setExportingLogsCsv(true);
    const result = await exportEventLogsCsv(event.id);
    setExportingLogsCsv(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się wyeksportować logów CSV',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Eksport logów CSV rozpoczęty' });
  };

  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    const result = await deleteEvent(event.id);
    setIsDeletingEvent(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się usunąć wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteConfirmOpen(false);
    toast({ title: 'Wydarzenie usunięte' });
    navigate('/events');
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/events')} className="touch-manipulation">
        <ArrowLeft className="h-4 w-4 mr-1" /> Wróć
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Biuro: {formatEventOfficeWindow(event)}</span>
          </div>
        </div>
        {canEditEvent && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={() => setEditOpen(true)} className="w-full self-start sm:w-auto">
              <Pencil className="mr-1 h-4 w-4" /> Edytuj wydarzenie
            </Button>
            <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} className="w-full self-start sm:w-auto">
              <Trash2 className="mr-1 h-4 w-4" /> Usuń wydarzenie
            </Button>
          </div>
        )}
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Skanerzy wydarzenia</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Skanerzy z organizacji przypisani bezpośrednio do tego wydarzenia.
            </p>
          </div>
          {canManageScanners && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={openScannerDialog}>
              Zarządzaj skanerami
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {organizationScanners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak skanerów w organizacji tego wydarzenia.</p>
          ) : assignedScanners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Do tego wydarzenia nie przypisano jeszcze żadnego skanera.</p>
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={() => void handleExportCsv()} className="h-11 w-full sm:h-10 sm:w-auto touch-manipulation" disabled={exportingCsv}>
          {exportingCsv ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Eksportuj CSV
        </Button>
        <Button variant="outline" onClick={() => void handleExportLogsCsv()} className="h-11 w-full sm:h-10 sm:w-auto touch-manipulation" disabled={exportingLogsCsv}>
          {exportingLogsCsv ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Eksportuj logi CSV
        </Button>
        <Button onClick={() => { setSelectedEventId(event.id); navigate('/scanner'); }} className="h-11 w-full sm:h-10 sm:w-auto touch-manipulation">
          <ScanLine className="h-4 w-4 mr-1" /> Otwórz skaner
        </Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/participants'); }} className="h-11 w-full sm:h-10 sm:w-auto touch-manipulation">
          <Users className="h-4 w-4 mr-1" /> Uczestnicy
        </Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate(`/events/${event.id}/import`); }} className="h-11 w-full sm:h-10 sm:w-auto touch-manipulation">
          <FileUp className="h-4 w-4 mr-1" /> Importuj CSV
        </Button>
        {hasSavedMapping && (
          <Button variant="outline" onClick={() => setManualOpen(true)} className="h-11 w-full sm:h-10 sm:w-auto touch-manipulation">
            <UserPlus className="h-4 w-4 mr-1" /> Dodaj ręcznie
          </Button>
        )}
      </div>

      {canViewParticipantMappings && (
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
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wydarzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Wydarzenie <span className="font-medium text-foreground">{event.name}</span> zostanie usunięte razem z uczestnikami przypisanymi do tego wydarzenia. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteEvent()} disabled={isDeletingEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingEvent && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Usuń wydarzenie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj wydarzenie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nazwa</Label><Input value={editForm.name} onChange={eventValue => setEditForm(current => ({ ...current, name: eventValue.target.value }))} /></div>
            <div><Label>Lokalizacja</Label><Input value={editForm.location} onChange={eventValue => setEditForm(current => ({ ...current, location: eventValue.target.value }))} /></div>
            <div><Label>Data i godzina otwarcia biura zawodów</Label><Input type="datetime-local" value={editForm.office_open_at} onChange={eventValue => setEditForm(current => ({ ...current, office_open_at: eventValue.target.value }))} /></div>
            <div><Label>Data i godzina zamknięcia biura zawodów</Label><Input type="datetime-local" value={editForm.office_close_at} onChange={eventValue => setEditForm(current => ({ ...current, office_close_at: eventValue.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleEditSubmit} disabled={!editForm.name || !editForm.location || !editForm.office_open_at || !editForm.office_close_at || editSaving}>
              {editSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button className="w-full sm:w-auto" onClick={handleManualSubmit} disabled={manualSaving}>
              {manualSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zapisz uczestnika
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scannerDialogOpen} onOpenChange={setScannerDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Przypisz skanerów do wydarzenia</DialogTitle>
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
                Brak skanerów w organizacji tego wydarzenia.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleSaveScannerAssignments} disabled={scannerSaving || organizationScanners.length === 0}>
              {scannerSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz przypisania
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
