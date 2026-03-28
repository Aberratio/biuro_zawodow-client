import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CalendarDays, Users, Radio, ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

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
    updateOrganizationEventLimit,
    assignScannerEvents,
    isLoading,
  } = useMockData();

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [scannerAssignmentsDialogOpen, setScannerAssignmentsDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
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
    date: '',
    location: '',
  });
  const [scannerAssignmentDraft, setScannerAssignmentDraft] = useState<string[]>([]);
  const [limitDraft, setLimitDraft] = useState('');

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
  const canManageMembers = currentRole === 'superadmin' || currentRole === 'admin';
  const canManageScanners = currentRole === 'superadmin' || currentRole === 'admin' || currentRole === 'editor';
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
      toast({ title: 'Nieprawidlowy email', description: 'Podaj poprawny adres email.', variant: 'destructive' });
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
      toast({ title: 'Nie udalo sie dodac konta', description: result.error ?? 'Sprobuj ponownie.', variant: 'destructive' });
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
      toast({ title: 'Nieprawidlowy limit', description: 'Podaj liczbe calkowita wieksza lub rowna 0.', variant: 'destructive' });
      return;
    }

    const result = await updateOrganizationEventLimit(organization.id, parsed);
    if (!result.ok) {
      toast({ title: 'Nie udalo sie zapisac limitu', description: result.error ?? 'Sprobuj ponownie.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Zaktualizowano limit wydarzen' });
  };

  const handleAddEvent = async () => {
    if (!eventForm.name || !eventForm.date || !eventForm.location) return;

    setIsSubmittingEvent(true);
    const result = await createEvent({
      name: eventForm.name,
      date: eventForm.date,
      location: eventForm.location,
      organization_id: organization.id,
    });
    setIsSubmittingEvent(false);

    if (!result.ok) {
      toast({ title: 'Nie udalo sie utworzyc wydarzenia', description: result.error ?? 'Sprobuj ponownie.', variant: 'destructive' });
      return;
    }

    setEventDialogOpen(false);
    setEventForm({ name: '', date: '', location: '' });
    toast({ title: 'Wydarzenie utworzone' });
  };

  const handleSaveScannerAssignments = async () => {
    if (!selectedScannerId) return;

    setIsSavingScannerAssignments(true);
    const result = await assignScannerEvents(selectedScannerId, scannerAssignmentDraft);
    setIsSavingScannerAssignments(false);

    if (!result.ok) {
      toast({ title: 'Nie udalo sie zapisac przypisan skanera', description: result.error ?? 'Sprobuj ponownie.', variant: 'destructive' });
      return;
    }

    setScannerAssignmentsDialogOpen(false);
    toast({ title: 'Zapisano przypisania skanera' });
  };

  const getEventNames = (eventIds: string[]) => {
    const names = orgEvents.filter(event => eventIds.includes(event.id)).map(event => event.name);
    return names.length > 0 ? names.join(', ') : 'Brak przypisanych wydarzen';
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/organizations')} className="touch-manipulation">
        <ArrowLeft className="mr-1 h-4 w-4" /> Wroc do organizacji
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
              <Badge variant="secondary">{orgEvents.length}/{organization.event_limit} wydarzen</Badge>
              <Badge variant="outline">{remainingSlots} wolnych miejsc</Badge>
              <Badge variant="outline">{organizers.length} organizatorow</Badge>
              <Badge variant="outline">{scanners.length} skanerow</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {(currentRole === 'superadmin' || currentRole === 'admin') && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label>Limit wydarzen</Label>
                  <Input type="number" min="0" value={limitDraft || String(organization.event_limit)} onChange={e => setLimitDraft(e.target.value)} />
                </div>
                <Button onClick={handleSaveLimit}>Zapisz limit</Button>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Wydarzenia</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pozostalo {remainingSlots} miejsc</span>
                {canCreateEvent && (
                  <Button size="sm" variant="outline" onClick={() => setEventDialogOpen(true)}>
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
                      <div className="text-xs text-muted-foreground">{event.date} • {event.location}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/events/${event.id}`)}>
                      Wejdz do wydarzenia
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Brak wydarzen dla tej organizacji.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Organizatorzy</h2>
              </div>
              {canManageMembers && <Button size="sm" variant="outline" onClick={() => openMemberDialog('editor')}>Dodaj organizatora</Button>}
            </div>
            <div className="grid gap-2">
              {organizers.length > 0 ? organizers.map(organizer => (
                <div key={organizer.id} className="rounded-xl border bg-background px-4 py-3">
                  <div className="text-sm font-medium">{organizer.name}</div>
                  <div className="text-xs text-muted-foreground">{organizer.email}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Organizacja: {organization.name}</div>
                </div>
              )) : <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Brak organizatorow w tej organizacji.</div>}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Skanerzy</h2>
              </div>
              {canManageScanners && <Button size="sm" variant="outline" onClick={() => openMemberDialog('scanner')}>Dodaj skanera</Button>}
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
                      <Button size="sm" variant="outline" onClick={() => openScannerAssignmentsDialog(scanner.id)}>
                        Przypisz wydarzenia
                      </Button>
                    )}
                  </div>
                </div>
              )) : <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Brak skanerow w tej organizacji.</div>}
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>{memberForm.role === 'editor' ? 'Dodaj organizatora' : 'Dodaj skanera'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Imie i nazwisko</Label><Input value={memberForm.name} onChange={e => setMemberForm(prev => ({ ...prev, name: e.target.value }))} /></div>
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
            <Button onClick={handleAddMember} disabled={!memberForm.name || !memberForm.email || isSubmittingMember}>Zapisz</Button>
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
            <Button onClick={handleSaveScannerAssignments} disabled={isSavingScannerAssignments}>Zapisz przypisania</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Dodaj wydarzenie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nazwa</Label><Input value={eventForm.name} onChange={e => setEventForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label>Data</Label><Input type="date" value={eventForm.date} onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))} /></div>
            <div><Label>Lokalizacja</Label><Input value={eventForm.location} onChange={e => setEventForm(prev => ({ ...prev, location: e.target.value }))} /></div>
            <p className="text-[10px] text-muted-foreground">Limit organizacji: {orgEvents.length}/{organization.event_limit} wydarzen.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleAddEvent} disabled={!eventForm.name || !eventForm.date || !eventForm.location || remainingSlots <= 0 || isSubmittingEvent}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
