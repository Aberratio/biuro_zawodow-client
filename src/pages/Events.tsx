import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EventsSkeleton from '@/components/skeletons/EventsSkeleton';
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeWindow, isValidEventOfficeRange } from '@/lib/events';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';

export default function Events() {
  const {
    visibleEvents,
    participants,
    organizations,
    createEvent,
    currentUser,
    currentRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
    isLoading,
  } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const adminOrganizationIds = currentUser.organization_ids ?? [];
  const adminOrganizations = useMemo(
    () => organizations.filter(org => adminOrganizationIds.includes(org.id)),
    [adminOrganizationIds, organizations],
  );
  const organizationNames = useMemo(
    () => Object.fromEntries(organizations.map(org => [org.id, org.name])),
    [organizations],
  );
  const canCreateEvent = currentRole !== 'scanner';
  const showOrganizationColumn = currentRole === 'superadmin';
  const [form, setForm] = useState({
    name: '',
    location: '',
    office_open_at: '',
    office_close_at: '',
    organization_id: currentRole === 'admin'
      ? (selectedOrganizationId || adminOrganizationIds[0] || currentUser.organization_id || organizations[0]?.id || '')
      : (currentUser.organization_id || organizations[0]?.id || ''),
  });

  useEffect(() => {
    if (currentRole !== 'admin') return;

    const nextOrganizationId = form.organization_id && adminOrganizationIds.includes(form.organization_id)
      ? form.organization_id
      : (selectedOrganizationId || adminOrganizationIds[0] || currentUser.organization_id || organizations[0]?.id || '');

    if (nextOrganizationId !== form.organization_id) {
      setForm(current => ({ ...current, organization_id: nextOrganizationId }));
    }
  }, [adminOrganizationIds, currentRole, currentUser.organization_id, form.organization_id, organizations, selectedOrganizationId]);

  const pageOrganizationId = currentRole === 'admin'
    ? selectedOrganizationId
    : currentUser.organization_id || '';
  const pageOrganization = useMemo(
    () => organizations.find(org => org.id === pageOrganizationId),
    [organizations, pageOrganizationId],
  );
  const filteredEvents = useMemo(
    () => currentRole === 'admin'
      ? visibleEvents.filter(event => event.organization_id === selectedOrganizationId)
      : visibleEvents,
    [currentRole, selectedOrganizationId, visibleEvents],
  );
  const eventRows = useMemo(
    () => filteredEvents.map(event => {
      const eventParticipants = participants.filter(participant => participant.event_id === event.id);
      const checkedInCount = eventParticipants.filter(participantCountsAsCheckedIn).length;

      return {
        ...event,
        checkedInCount,
        participantCount: eventParticipants.length,
        organizationName: organizationNames[event.organization_id] ?? 'Nieznana organizacja',
      };
    }),
    [filteredEvents, organizationNames, participants],
  );
  const usedSlots = filteredEvents.length;
  const formOrganization = useMemo(
    () => organizations.find(org => org.id === form.organization_id),
    [form.organization_id, organizations],
  );
  const formOrganizationUsedSlots = useMemo(
    () => visibleEvents.filter(event => event.organization_id === form.organization_id).length,
    [form.organization_id, visibleEvents],
  );

  if (isLoading) return <EventsSkeleton />;

  const handleCreate = async () => {
    if (!form.name || !form.location || !form.organization_id) return;
    if (!form.office_open_at || !form.office_close_at || !isValidEventOfficeRange(form.office_open_at, form.office_close_at)) {
      toast({
        title: 'Nieprawidłowe godziny biura',
        description: 'Podaj wymaganą datę i godzinę otwarcia oraz zamknięcia biura zawodów. Otwarcie musi być wcześniejsze od zamknięcia.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await createEvent({
      name: form.name,
      location: form.location,
      organization_id: form.organization_id,
      office_open_at: form.office_open_at,
      office_close_at: form.office_close_at,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się utworzyć wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setForm({
      name: '',
      location: '',
      office_open_at: '',
      office_close_at: '',
      organization_id: currentRole === 'admin'
        ? (selectedOrganizationId || adminOrganizationIds[0] || organizations[0]?.id || '')
        : (currentUser.organization_id || organizations[0]?.id || ''),
    });
    setOpen(false);
    toast({ title: 'Wydarzenie utworzone' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Wydarzenia</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Lista wydarzeń oraz kontrola limitu przypisanego do organizacji.
          </p>
        </div>
        {canCreateEvent && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto">
            <Plus className="mr-1 h-4 w-4" /> Nowe wydarzenie
          </Button>
        )}
      </div>

      {currentRole === 'admin' && adminOrganizations.length > 0 && (
        <div className="max-w-md space-y-2">
          <Label htmlFor="events-organization-filter">Organizacja</Label>
          <Select value={selectedOrganizationId} onValueChange={setSelectedOrganizationId}>
            <SelectTrigger id="events-organization-filter">
              <SelectValue placeholder="Wybierz organizację" />
            </SelectTrigger>
            <SelectContent>
              {adminOrganizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {pageOrganization && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{pageOrganization.name}</p>
              <p className="text-xs text-muted-foreground">
                Wykorzystano {usedSlots} z {pageOrganization.event_limit} dostępnych wydarzeń.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Pozostało: {Math.max(pageOrganization.event_limit - usedSlots, 0)}
            </div>
          </CardContent>
        </Card>
      )}

      {eventRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">Brak wydarzeń dla aktualnego zakresu.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  {showOrganizationColumn && <TableHead className="hidden lg:table-cell">Organizacja</TableHead>}
                  <TableHead className="hidden md:table-cell">Lokalizacja</TableHead>
                  <TableHead>Biuro</TableHead>
                  <TableHead className="hidden sm:table-cell">Odprawieni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRows.map(event => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer active:bg-accent/50"
                    onClick={() => navigate(`/events/${event.id}`)}
                    onKeyDown={keyboardEvent => {
                      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                        keyboardEvent.preventDefault();
                        navigate(`/events/${event.id}`);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Otwórz wydarzenie ${event.name}`}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{event.name}</span>
                        <span className="block truncate text-xs text-muted-foreground md:hidden">
                          {event.location}
                        </span>
                        {showOrganizationColumn && (
                          <span className="block truncate text-xs text-muted-foreground lg:hidden">
                            {event.organizationName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {showOrganizationColumn && (
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {event.organizationName}
                      </TableCell>
                    )}
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {event.location}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatEventOfficeWindow(event)}
                    </TableCell>
                    <TableCell className="hidden text-sm tabular-nums sm:table-cell">
                      {event.checkedInCount}/{event.participantCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{eventRows.length} wydarzeń</p>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nowe wydarzenie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(currentRole === 'superadmin' || currentRole === 'admin') && (
              <div>
                <Label>Organizacja</Label>
                <Select value={form.organization_id} onValueChange={value => setForm(current => ({ ...current, organization_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz organizację" /></SelectTrigger>
                  <SelectContent>
                    {organizations
                      .filter(org => currentRole === 'superadmin' || adminOrganizationIds.includes(org.id))
                      .map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Nazwa</Label><Input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="np. Bieg Wiosenny" /></div>
            <div><Label>Lokalizacja</Label><Input value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} placeholder="np. Kraków, Błonia" /></div>
            <div><Label>Data i godzina otwarcia biura zawodów</Label><Input type="datetime-local" value={form.office_open_at} onChange={event => setForm(current => ({ ...current, office_open_at: event.target.value }))} /></div>
            <div><Label>Data i godzina zamknięcia biura zawodów</Label><Input type="datetime-local" value={form.office_close_at} onChange={event => setForm(current => ({ ...current, office_close_at: event.target.value }))} /></div>
            {formOrganization && (
              <p className="text-[10px] text-muted-foreground">
                Limit organizacji: {formOrganizationUsedSlots}/{formOrganization.event_limit} wydarzeń.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={!form.name || !form.location || !form.office_open_at || !form.office_close_at || !form.organization_id || (formOrganization ? formOrganizationUsedSlots >= formOrganization.event_limit : false) || isSubmitting}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Utwórz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
