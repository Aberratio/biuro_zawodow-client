import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CalendarDays, Users, Radio, ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeWindow, isValidEventOfficeRange } from '@/lib/events';

type MemberRole = 'editor' | 'scanner';

export default function OrganizationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    organizations,
    events,
    users,
    currentRole,
    currentUser,
    addUser,
    createEvent,
    updateOrganization,
    updateOrganizationEventLimit,
    deleteOrganization,
    assignScannerEvents,
    isLoading,
  } = useData();

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [scannerAssignmentsDialogOpen, setScannerAssignmentsDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [organizationEditOpen, setOrganizationEditOpen] = useState(false);
  const [deleteOrganizationConfirmOpen, setDeleteOrganizationConfirmOpen] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const [isSavingScannerAssignments, setIsSavingScannerAssignments] = useState(false);
  const [selectedScannerId, setSelectedScannerId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    role: 'editor' as MemberRole,
    name: '',
    email: '',
    assigned_events: [] as string[],
  });
  const [eventForm, setEventForm] = useState({
    name: '',
    location: '',
    office_open_at: '',
    office_close_at: '',
  });
  const [scannerAssignmentDraft, setScannerAssignmentDraft] = useState<string[]>([]);
  const [limitDraft, setLimitDraft] = useState('');
  const [organizationNameDraft, setOrganizationNameDraft] = useState('');

  const organization = useMemo(() => organizations.find(org => org.id === id), [id, organizations]);

  const allowed = useMemo(() => {
    if (!organization) return false;
    if (currentRole === 'superadmin') return true;
    if (currentRole === 'admin') return (currentUser.organization_ids ?? []).includes(organization.id);
    return currentUser.organization_id === organization.id;
  }, [currentRole, currentUser, organization]);

  if (isLoading) return <TableSkeleton rows={4} cols={4} subtitle="" />;
  if (!organization || !allowed) return <div className="py-12 text-center text-muted-foreground">Nie znaleziono organizacji.</div>;

  const orgEvents = events.filter(event => event.organization_id === organization.id);
  const organizers = users.filter(user => user.organization_id === organization.id && user.role === 'editor');
  const scanners = users.filter(user => user.organization_id === organization.id && user.role === 'scanner');
  const remainingSlots = Math.max(organization.event_limit - orgEvents.length, 0);
  const canCreateEvent = currentRole !== 'scanner';
  const canEditOrganization = currentRole === 'superadmin' || currentRole === 'admin';
  const canManageMembers = currentRole === 'superadmin' || currentRole === 'admin';
  const canManageScanners = currentRole === 'superadmin' || currentRole === 'admin' || currentRole === 'editor';
  const canDeleteOrganization = canEditOrganization && orgEvents.length === 0 && organizers.length === 0 && scanners.length === 0;
  const adminLabel = organization.admin_user_name
    ?? users.find(user => user.id === organization.admin_user_id)?.name
    ?? 'Brak administratora';

  const openMemberDialog = (role: MemberRole) => {
    setMemberForm({
      role,
      name: '',
      email: '',
      assigned_events: [],
    });
    setMemberDialogOpen(true);
  };

  const openScannerAssignmentsDialog = (scannerId: string) => {
    const scanner = scanners.find(user => user.id === scannerId);
    setSelectedScannerId(scannerId);
    setScannerAssignmentDraft(scanner?.assigned_events ?? []);
    setScannerAssignmentsDialogOpen(true);
  };

  const openOrganizationEditDialog = () => {
    setOrganizationNameDraft(organization.name);
    setOrganizationEditOpen(true);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const toggleScannerEvent = (eventId: string, checked: boolean) => {
    setMemberForm(prev => ({
      ...prev,
      assigned_events: checked
        ? [...prev.assigned_events, eventId]
        : prev.assigned_events.filter(idValue => idValue !== eventId),
    }));
  };

  const toggleScannerAssignmentDraft = (eventId: string, checked: boolean) => {
    setScannerAssignmentDraft(prev => (
      checked ? [...prev, eventId] : prev.filter(idValue => idValue !== eventId)
    ));
  };

  const handleAddMember = async () => {
    if (!validateEmail(memberForm.email)) {
      toast({ title: 'Nieprawidłowy email', description: 'Podaj poprawny adres email.', variant: 'destructive' });
      return;
    }

    setIsSubmittingMember(true);
    const result = await addUser({
      name: memberForm.name,
      email: memberForm.email,
      role: memberForm.role,
      organization_id: organization.id,
      assigned_events: memberForm.role === 'scanner' ? memberForm.assigned_events : [],
    });
    setIsSubmittingMember(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się dodać konta', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setMemberDialogOpen(false);
    toast({
      title: memberForm.role === 'editor' ? 'Dodano organizatora' : 'Dodano skanera',
      description: 'Użytkownik otrzyma mail z linkiem do ustawienia własnego hasła.',
    });
  };

  const handleSaveLimit = async () => {
    const parsed = Number(limitDraft || organization.event_limit);
    if (!Number.isInteger(parsed) || parsed < 0) {
      toast({ title: 'Nieprawidłowy limit', description: 'Podaj liczbę całkowitą większą lub równą 0.', variant: 'destructive' });
      return;
    }
    if (parsed < orgEvents.length) {
      toast({
        title: 'Nieprawidłowy limit',
        description: `Limit wydarzeń nie może być mniejszy niż ${orgEvents.length}, bo tyle wydarzeń jest już przypisanych do tej organizacji.`,
        variant: 'destructive',
      });
      return;
    }

    const result = await updateOrganizationEventLimit(organization.id, parsed);
    if (!result.ok) {
      toast({ title: 'Nie udało się zapisać limitu', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Zaktualizowano limit wydarzeń' });
  };

  const handleSaveOrganization = async () => {
    const name = organizationNameDraft.trim();
    if (!name) {
      toast({ title: 'Nazwa jest wymagana', variant: 'destructive' });
      return;
    }

    setIsSavingOrganization(true);
    const result = await updateOrganization(organization.id, { name });
    setIsSavingOrganization(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się zaktualizować organizacji', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setOrganizationEditOpen(false);
    toast({ title: 'Zaktualizowano organizację' });
  };

  const handleAddEvent = async () => {
    if (!eventForm.name || !eventForm.location) return;
    if (!eventForm.office_open_at || !eventForm.office_close_at || !isValidEventOfficeRange(eventForm.office_open_at, eventForm.office_close_at)) {
      toast({ title: 'Nieprawidłowe godziny biura', description: 'Podaj poprawną datę i godzinę otwarcia oraz zamknięcia biura zawodów.', variant: 'destructive' });
      return;
    }

    setIsSubmittingEvent(true);
    const result = await createEvent({
      name: eventForm.name,
      location: eventForm.location,
      organization_id: organization.id,
      office_open_at: eventForm.office_open_at,
      office_close_at: eventForm.office_close_at,
    });
    setIsSubmittingEvent(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się utworzyć wydarzenia', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setEventDialogOpen(false);
    setEventForm({ name: '', location: '', office_open_at: '', office_close_at: '' });
    toast({ title: 'Wydarzenie utworzone' });
  };

  const handleSaveScannerAssignments = async () => {
    if (!selectedScannerId) return;

    setIsSavingScannerAssignments(true);
    const result = await assignScannerEvents(selectedScannerId, scannerAssignmentDraft);
    setIsSavingScannerAssignments(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się zapisać przypisań skanera', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setScannerAssignmentsDialogOpen(false);
    toast({ title: 'Zapisano przypisania skanera' });
  };

  const handleDeleteOrganization = async () => {
    setIsDeletingOrganization(true);
    const result = await deleteOrganization(organization.id);
    setIsDeletingOrganization(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się usunąć organizacji', description: result.error ?? 'Usuń najpierw wydarzenia i użytkowników przypisanych do organizacji.', variant: 'destructive' });
      return;
    }

    setDeleteOrganizationConfirmOpen(false);
    toast({ title: 'Organizacja usunięta' });
    navigate('/organizations');
  };

  const getEventNames = (eventIds: string[]) => {
    const names = orgEvents.filter(event => eventIds.includes(event.id)).map(event => event.name);
    return names.length > 0 ? names.join(', ') : 'Brak przypisanych wydarzeń';
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/organizations')} className="touch-manipulation">
        <ArrowLeft className="mr-1 h-4 w-4" /> Wróć do organizacji
      </Button>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{organization.name}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Administrator: {adminLabel}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{orgEvents.length}/{organization.event_limit} wydarzeń</Badge>
              <Badge variant="outline">{remainingSlots} wolnych miejsc</Badge>
              <Badge variant="outline">{organizers.length} organizatorów</Badge>
              <Badge variant="outline">{scanners.length} skanerów</Badge>
            </div>
          </div>
          {canEditOrganization && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={openOrganizationEditDialog}>
                <Pencil className="mr-1 h-4 w-4" />
                Edytuj organizację
              </Button>
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => setDeleteOrganizationConfirmOpen(true)} disabled={!canDeleteOrganization}>
                <Trash2 className="mr-1 h-4 w-4" />
                Usuń organizację
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {(currentRole === 'superadmin' || currentRole === 'admin') && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label>Limit wydarzeń</Label>
                  <Input type="number" min={String(orgEvents.length)} value={limitDraft || String(organization.event_limit)} onChange={e => setLimitDraft(e.target.value)} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Minimalny dozwolony limit to <span className="font-medium text-foreground">{orgEvents.length}</span>, bo tyle wydarzeń jest już przypisanych do tej organizacji.
                  </p>
                </div>
                <Button className="w-full sm:w-auto" onClick={handleSaveLimit}>Zapisz limit</Button>
              </div>
              {!canDeleteOrganization && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Organizację można usunąć dopiero wtedy, gdy nie ma już przypisanych wydarzeń, organizatorów ani skanerów.
                </p>
              )}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Wydarzenia</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs text-muted-foreground">Pozostało {remainingSlots} miejsc</span>
                {canCreateEvent && (
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setEventDialogOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Dodaj wydarzenie
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {orgEvents.length > 0 ? orgEvents.map(event => (
                <div key={event.id} className="rounded-xl border bg-background px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{event.name}</div>
                      <div className="text-xs text-muted-foreground">{event.location}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Biuro: {formatEventOfficeWindow(event)}</div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/events/${event.id}`)}>
                      Wejdź do wydarzenia
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Brak wydarzeń dla tej organizacji.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Organizatorzy</h2>
              </div>
              {canManageMembers && <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openMemberDialog('editor')}><Plus className="mr-1 h-4 w-4" />Dodaj organizatora</Button>}
            </div>
            <div className="grid gap-2">
              {organizers.length > 0 ? organizers.map(organizer => (
                <div key={organizer.id} className="rounded-xl border bg-background px-4 py-3">
                  <div className="text-sm font-medium">{organizer.name}</div>
                  <div className="text-xs text-muted-foreground">{organizer.email}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Organizacja: {organization.name}</div>
                </div>
              )) : <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Brak organizatorów w tej organizacji.</div>}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Skanerzy</h2>
              </div>
              {canManageScanners && <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openMemberDialog('scanner')}><Plus className="mr-1 h-4 w-4" />Dodaj skanera</Button>}
            </div>
            <div className="grid gap-2">
              {scanners.length > 0 ? scanners.map(scanner => (
                <div key={scanner.id} className="rounded-xl border bg-background px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{scanner.name}</div>
                      <div className="text-xs text-muted-foreground">{scanner.email}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Wydarzenia: {getEventNames(scanner.assigned_events)}</div>
                    </div>
                    {canManageScanners && (
                      <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openScannerAssignmentsDialog(scanner.id)}>
                        Przypisz wydarzenia
                      </Button>
                    )}
                  </div>
                </div>
              )) : <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Brak skanerów w tej organizacji.</div>}
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog open={organizationEditOpen} onOpenChange={setOrganizationEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Edytuj organizację</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa organizacji</Label>
              <Input value={organizationNameDraft} onChange={e => setOrganizationNameDraft(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleSaveOrganization} disabled={!organizationNameDraft.trim() || isSavingOrganization}>
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOrganizationConfirmOpen} onOpenChange={setDeleteOrganizationConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć organizację?</AlertDialogTitle>
            <AlertDialogDescription>
              Organizacja <span className="font-medium text-foreground">{organization.name}</span> zostanie usunięta tylko wtedy, gdy nie ma już przypisanych wydarzeń ani użytkowników. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteOrganization()} disabled={isDeletingOrganization || !canDeleteOrganization} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń organizację
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>{memberForm.role === 'editor' ? 'Dodaj organizatora' : 'Dodaj skanera'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Imię i nazwisko</Label><Input value={memberForm.name} onChange={e => setMemberForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={memberForm.email} onChange={e => setMemberForm(prev => ({ ...prev, email: e.target.value }))} /></div>
            <p className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Po zapisaniu konto zostanie utworzone, a użytkownik dostanie mail z bezpiecznym linkiem do ustawienia własnego hasła.
            </p>
            {memberForm.role === 'scanner' && orgEvents.length > 0 && (
              <div className="space-y-2">
                <Label>Przypisane wydarzenia</Label>
                <div className="space-y-2 rounded-xl border p-3">
                  {orgEvents.map(event => (
                    <label key={event.id} className="flex items-center gap-3 text-sm">
                      <Checkbox checked={memberForm.assigned_events.includes(event.id)} onCheckedChange={checked => toggleScannerEvent(event.id, checked === true)} />
                      <span>{event.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleAddMember} disabled={!memberForm.name || !memberForm.email || isSubmittingMember}><Plus className="mr-1 h-4 w-4" />Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scannerAssignmentsDialogOpen} onOpenChange={setScannerAssignmentsDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Przypisz wydarzenia skanerowi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {orgEvents.length > 0 ? (
              <div className="space-y-2 rounded-xl border p-3">
                {orgEvents.map(event => (
                  <label key={event.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={scannerAssignmentDraft.includes(event.id)} onCheckedChange={checked => toggleScannerAssignmentDraft(event.id, checked === true)} />
                    <span>{event.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Najpierw dodaj wydarzenia do tej organizacji.</div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleSaveScannerAssignments} disabled={isSavingScannerAssignments}>Zapisz przypisania</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Dodaj wydarzenie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nazwa</Label><Input value={eventForm.name} onChange={e => setEventForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label>Lokalizacja</Label><Input value={eventForm.location} onChange={e => setEventForm(prev => ({ ...prev, location: e.target.value }))} /></div>
            <div><Label>Data i godzina otwarcia biura zawodów</Label><Input type="datetime-local" value={eventForm.office_open_at} onChange={e => setEventForm(prev => ({ ...prev, office_open_at: e.target.value }))} /></div>
            <div><Label>Data i godzina zamknięcia biura zawodów</Label><Input type="datetime-local" value={eventForm.office_close_at} onChange={e => setEventForm(prev => ({ ...prev, office_close_at: e.target.value }))} /></div>
            <p className="text-[10px] text-muted-foreground">Limit organizacji: {orgEvents.length}/{organization.event_limit} wydarzeń.</p>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleAddEvent} disabled={!eventForm.name || !eventForm.location || !eventForm.office_open_at || !eventForm.office_close_at || remainingSlots <= 0 || isSubmittingEvent}><Plus className="mr-1 h-4 w-4" />Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
