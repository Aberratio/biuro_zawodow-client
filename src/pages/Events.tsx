import { useMemo, useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar } from 'lucide-react';
import EventsSkeleton from '@/components/skeletons/EventsSkeleton';
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeWindow, isValidEventOfficeRange } from '@/lib/events';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';

export default function Events() {
  const { visibleEvents, participants, organizations, createEvent, currentUser, currentRole, isLoading } = useMockData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const adminOrganizationIds = currentUser.organization_ids ?? [];
  const canCreateEvent = currentRole !== 'scanner';
  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    office_open_at: '',
    office_close_at: '',
    organization_id: currentRole === 'admin'
      ? (adminOrganizationIds[0] || currentUser.organization_id || organizations[0]?.id || '')
      : (currentUser.organization_id || organizations[0]?.id || ''),
  });

  const selectedOrganizationId = currentRole === 'superadmin'
    ? form.organization_id
    : currentRole === 'admin'
      ? form.organization_id
      : currentUser.organization_id || '';
  const selectedOrganization = useMemo(
    () => organizations.find(org => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId],
  );
  const usedSlots = visibleEvents.filter(event => event.organization_id === selectedOrganizationId).length;

  if (isLoading) return <EventsSkeleton />;

  const handleCreate = async () => {
    if (!form.name || !form.date || !form.location || !selectedOrganizationId) return;
    if (!form.office_open_at || !form.office_close_at || !isValidEventOfficeRange(form.office_open_at, form.office_close_at)) {
      toast({
        title: 'Nieprawidlowe godziny biura',
        description: 'Podaj wymagane daty i godziny otwarcia oraz zamkniecia biura zawodow. Godzina otwarcia musi byc wczesniejsza od zamkniecia.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await createEvent({
      name: form.name,
      date: form.date,
      location: form.location,
      organization_id: selectedOrganizationId,
      office_open_at: form.office_open_at,
      office_close_at: form.office_close_at,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast({
        title: 'Nie udalo sie utworzyc wydarzenia',
        description: result.error ?? 'Sprobuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setForm({
      name: '',
      date: '',
      location: '',
      office_open_at: '',
      office_close_at: '',
      organization_id: currentRole === 'admin'
        ? (adminOrganizationIds[0] || organizations[0]?.id || '')
        : (currentUser.organization_id || organizations[0]?.id || ''),
    });
    setOpen(false);
    toast({ title: 'Wydarzenie utworzone' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 justify-between sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Wydarzenia</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Lista wydarzen oraz kontrola limitu przypisanego do organizacji.
          </p>
        </div>
        {canCreateEvent && (
          <Button onClick={() => setOpen(true)} size="sm" className="self-start sm:self-auto">
            <Plus className="mr-1 h-4 w-4" /> Nowe wydarzenie
          </Button>
        )}
      </div>

      {selectedOrganization && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-2 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{selectedOrganization.name}</p>
              <p className="text-xs text-muted-foreground">
                Wykorzystano {usedSlots} z {selectedOrganization.event_limit} dostepnych wydarzen.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Pozostalo: {Math.max(selectedOrganization.event_limit - usedSlots, 0)}
            </div>
          </CardContent>
        </Card>
      )}

      {visibleEvents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">Brak wydarzen dla aktualnego zakresu.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleEvents.map(event => {
          const eventParticipants = participants.filter(participant => participant.event_id === event.id);
          const checkedIn = eventParticipants.filter(participantCountsAsCheckedIn).length;

          return (
            <Card key={event.id} className="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.98]" onClick={() => navigate(`/events/${event.id}`)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{event.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{event.location}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Biuro: {formatEventOfficeWindow(event)}
                </div>
                <div className="pt-2">
                  <div className="mb-1 flex justify-between text-xs">
                    <span>Odprawieni</span>
                    <span className="tabular-nums font-semibold">{checkedIn}/{eventParticipants.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${eventParticipants.length ? (checkedIn / eventParticipants.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nowe wydarzenie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(currentRole === 'superadmin' || currentRole === 'admin') && (
              <div>
                <Label>Organizacja</Label>
                <Select value={form.organization_id} onValueChange={value => setForm(current => ({ ...current, organization_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz organizacje" /></SelectTrigger>
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
            <div><Label>Data</Label><Input type="date" value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></div>
            <div><Label>Lokalizacja</Label><Input value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} placeholder="np. Krakow, Blonia" /></div>
            <div><Label>Otwarcie biura zawodow</Label><Input type="datetime-local" value={form.office_open_at} onChange={event => setForm(current => ({ ...current, office_open_at: event.target.value }))} /></div>
            <div><Label>Zamkniecie biura zawodow</Label><Input type="datetime-local" value={form.office_close_at} onChange={event => setForm(current => ({ ...current, office_close_at: event.target.value }))} /></div>
            {selectedOrganization && (
              <p className="text-[10px] text-muted-foreground">
                Limit organizacji: {usedSlots}/{selectedOrganization.event_limit} wydarzen.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={!form.name || !form.date || !form.location || !form.office_open_at || !form.office_close_at || !selectedOrganizationId || (selectedOrganization ? usedSlots >= selectedOrganization.event_limit : false) || isSubmitting}
              className="h-11 sm:h-10"
            >
              Utworz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
