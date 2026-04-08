import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeEnd, formatEventOfficeStart, getEventOfficeCloseAt, getEventOfficeOpenAt, isEventOfficeOpen } from '@/lib/events';
import type { Event } from '@/types';

function getClosestOrganizationEventLabel(organizationEvents: Event[], now: Date): string {
  const activeEvent = organizationEvents
    .map(event => ({ event, closeAt: getEventOfficeCloseAt(event) }))
    .filter((entry): entry is { event: Event; closeAt: Date } => entry.closeAt !== null && isEventOfficeOpen(entry.event, now))
    .sort((left, right) => left.closeAt.getTime() - right.closeAt.getTime())[0];

  if (activeEvent) {
    return `W trakcie do ${formatEventOfficeEnd(activeEvent.event)}`;
  }

  const upcomingEvent = organizationEvents
    .map(event => ({ event, openAt: getEventOfficeOpenAt(event) }))
    .filter((entry): entry is { event: Event; openAt: Date } => entry.openAt !== null && entry.openAt.getTime() > now.getTime())
    .sort((left, right) => left.openAt.getTime() - right.openAt.getTime())[0];

  if (upcomingEvent) {
    return formatEventOfficeStart(upcomingEvent.event);
  }

  return 'Brak zaplanowanego';
}

export default function Organizations() {
  const navigate = useNavigate();
  const { organizations, events, users, currentRole, currentUser, createOrganization, isLoading } = useData();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ name: '', event_limit: '1', admin_user_id: '' });
  const admins = users.filter(user => user.role === 'admin');

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const visibleOrganizations = useMemo(() => {
    if (currentRole === 'superadmin') return organizations;
    if (currentRole === 'admin') return organizations.filter(org => (currentUser.organization_ids ?? []).includes(org.id));
    return organizations.filter(org => org.id === currentUser.organization_id);
  }, [currentRole, currentUser, organizations]);

  const shouldShowSearch = visibleOrganizations.length > 5;
  const normalizedQuery = shouldShowSearch ? searchQuery.trim().toLocaleLowerCase('pl-PL') : '';
  const now = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);

  const filteredOrganizations = useMemo(() => {
    return visibleOrganizations
      .filter(org => !normalizedQuery || org.name.toLocaleLowerCase('pl-PL').includes(normalizedQuery))
      .map(org => {
        const organizationEvents = events.filter(event => event.organization_id === org.id);
        const teamCount = users.filter(
          user => user.organization_id === org.id && (user.role === 'editor' || user.role === 'scanner')
        ).length;

        return {
          ...org,
          eventCount: organizationEvents.length,
          nextEventLabel: getClosestOrganizationEventLabel(organizationEvents, now),
          teamCount,
        };
      });
  }, [events, normalizedQuery, now, users, visibleOrganizations]);

  if (isLoading) return <TableSkeleton rows={8} cols={4} subtitle="" showFilters />;

  const handleCreate = async () => {
    const parsedLimit = Number(form.event_limit);
    if (!form.name || !Number.isInteger(parsedLimit) || parsedLimit < 0) {
      toast({ title: 'Nieprawidłowe dane', description: 'Podaj nazwę i poprawny limit wydarzeń.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    if (currentRole === 'superadmin' && !form.admin_user_id) {
      toast({ title: 'Brak administratora', description: 'Wybierz admina dla nowej organizacji.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    const result = await createOrganization({
      name: form.name,
      event_limit: parsedLimit,
      admin_user_id: currentRole === 'superadmin' ? form.admin_user_id : undefined,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się utworzyć organizacji', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setForm({ name: '', event_limit: '1', admin_user_id: '' });
    setOpen(false);
    toast({ title: 'Organizacja utworzona' });
    if (result.entityId) {
      navigate(`/organizations/${result.entityId}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Organizacje</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Lista organizacji. Kliknij wiersz, aby otworzyć szczegóły.
          </p>
        </div>
        {(currentRole === 'admin' || currentRole === 'superadmin') && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto">
            Nowa organizacja
          </Button>
        )}
      </div>

      {visibleOrganizations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div>
              <p className="font-medium">Brak organizacji do wyświetlenia</p>
              <p className="mt-1 text-sm text-muted-foreground">Gdy organizacje będą dostępne, pojawią się tutaj w tabeli.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {shouldShowSearch && (
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Szukaj po nazwie organizacji..."
              aria-label="Szukaj organizacji"
              className="h-11 max-w-md sm:h-10"
            />
          )}

          {filteredOrganizations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="font-medium">Nie znaleziono organizacji</p>
                <p className="mt-1 text-sm text-muted-foreground">Spróbuj wpisać inną frazę lub wyczyść wyszukiwanie.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="hidden md:table-cell">Najbliższe wydarzenie</TableHead>
                    <TableHead>Wydarzenia</TableHead>
                    <TableHead className="hidden sm:table-cell">Zespół</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.map(org => (
                    <TableRow
                      key={org.id}
                      className="cursor-pointer active:bg-accent/50"
                      onClick={() => navigate(`/organizations/${org.id}`)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/organizations/${org.id}`);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Otwórz organizację ${org.name}`}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{org.name}</span>
                          <span className="block truncate text-xs text-muted-foreground md:hidden">
                            {org.nextEventLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {org.nextEventLabel}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {org.eventCount}/{org.event_limit}
                      </TableCell>
                      <TableCell className="hidden text-sm tabular-nums sm:table-cell">
                        {org.teamCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{filteredOrganizations.length} organizacji</p>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa organizacja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label>Limit wydarzeń</Label>
              <Input type="number" min="0" value={form.event_limit} onChange={event => setForm(prev => ({ ...prev, event_limit: event.target.value }))} />
            </div>
            {currentRole === 'superadmin' && (
              <div>
                <Label>Administrator organizacji</Label>
                <Select value={form.admin_user_id} onValueChange={value => setForm(prev => ({ ...prev, admin_user_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz admina" />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreate}
              disabled={!form.name || !form.event_limit || (currentRole === 'superadmin' && !form.admin_user_id) || isSubmitting}
            >
              Utwórz organizację
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
