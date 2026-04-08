import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Info, ScanLine } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';
import { formatEventOfficeEnd, formatEventOfficeStart, formatEventOfficeWindow, getEventOfficeCloseAt, getEventOfficeOpenAt, isEventOfficeOpen } from '@/lib/events';
import type { Event } from '@/types';

export default function Dashboard() {
  const { currentRole, events, visibleEvents, participants, activityLog, selectedEventId, isLoading, organizations } = useData();
  const navigate = useNavigate();

  const currentEvent = visibleEvents.find(event => event.id === selectedEventId);
  const dashboardEvents = currentRole === 'superadmin' ? events : visibleEvents;

  const organizationNames = useMemo(
    () => Object.fromEntries(organizations.map(org => [org.id, org.name])),
    [organizations]
  );

  if (isLoading) return <DashboardSkeleton />;

  if (currentRole === 'admin' || currentRole === 'superadmin') {
    const now = new Date();
    const activeEvents = dashboardEvents
      .filter(event => isEventOfficeOpen(event, now))
      .sort((left, right) => (getEventOfficeCloseAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (getEventOfficeCloseAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    const upcomingEvents = dashboardEvents
      .filter(event => {
        const openAt = getEventOfficeOpenAt(event);
        return openAt !== null && openAt > now;
      })
      .sort((left, right) => (getEventOfficeOpenAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (getEventOfficeOpenAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    const finishedEvents = dashboardEvents
      .filter(event => {
        const closeAt = getEventOfficeCloseAt(event);
        return closeAt !== null && closeAt < now;
      })
      .sort((left, right) => (getEventOfficeCloseAt(right)?.getTime() ?? 0) - (getEventOfficeCloseAt(left)?.getTime() ?? 0))
      .slice(0, 5);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Panel</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Szybki podgląd aktualnie otwartych biur zawodów, nadchodzących startów i ostatnio zakończonych wydarzeń.
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Biuro zawodów otwarte teraz</h2>
              <p className="text-sm text-muted-foreground">Wydarzenia, które są aktualnie w trakcie odprawy.</p>
            </div>
            <Badge className="shrink-0" variant={activeEvents.length > 0 ? 'default' : 'secondary'}>
              {activeEvents.length} aktywne
            </Badge>
          </div>

          {activeEvents.length === 0 ? (
            <EmptyState
              title="Brak aktywnych wydarzeń"
              description="Gdy biuro zawodów będzie otwarte dla któregoś wydarzenia, pojawi się tutaj z szybkim wejściem i statystyką odpraw."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {activeEvents.map(event => (
                <ActiveEventCard
                  key={event.id}
                  event={event}
                  organizationName={organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
                  participantsCount={participants.filter(participant => participant.event_id === event.id).length}
                  checkedInCount={participants.filter(participant => participant.event_id === event.id && participantCountsAsCheckedIn(participant)).length}
                  onOpen={() => navigate(`/events/${event.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Nadchodzące wydarzenia</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Najbliższe otwarcia biura zawodów z informacją o organizacji.
                  </p>
                </div>
                <Badge variant="secondary">{upcomingEvents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingEvents.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Brak nadchodzących wydarzeń"
                    description="Po dodaniu kolejnych zawodów zobaczysz tutaj ich uporządkowaną listę."
                    compact
                  />
                </div>
              ) : (
                <EventOverviewTable
                  events={upcomingEvents}
                  organizationNames={organizationNames}
                  metaColumnLabel="Start biura"
                  getMetaValue={event => formatEventOfficeStart(event)}
                  onOpen={eventId => navigate(`/events/${eventId}`)}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Ostatnio zakończone</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pięć ostatnich wydarzeń zamkniętych po pracy biura zawodów.
                  </p>
                </div>
                <Badge variant="outline">{finishedEvents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {finishedEvents.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Brak zakończonych wydarzeń"
                    description="Zamknięte wydarzenia pojawią się tutaj automatycznie po upływie czasu pracy biura."
                    compact
                  />
                </div>
              ) : (
                <EventOverviewTable
                  events={finishedEvents}
                  organizationNames={organizationNames}
                  metaColumnLabel="Zamknięto"
                  getMetaValue={event => formatEventOfficeEnd(event)}
                  onOpen={eventId => navigate(`/events/${eventId}`)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentRole === 'editor') {
    const now = new Date();
    const activeEvents = visibleEvents
      .filter(event => isEventOfficeOpen(event, now))
      .sort((left, right) => (getEventOfficeCloseAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (getEventOfficeCloseAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    const upcomingEvents = visibleEvents
      .filter(event => {
        const openAt = getEventOfficeOpenAt(event);
        return openAt !== null && openAt > now;
      })
      .sort((left, right) => (getEventOfficeOpenAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (getEventOfficeOpenAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    const finishedEvents = visibleEvents
      .filter(event => {
        const closeAt = getEventOfficeCloseAt(event);
        return closeAt !== null && closeAt < now;
      })
      .sort((left, right) => (getEventOfficeCloseAt(right)?.getTime() ?? 0) - (getEventOfficeCloseAt(left)?.getTime() ?? 0))
      .slice(0, 5);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Panel</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Podgląd wydarzeń Twojej organizacji: aktywnych, nadchodzących i ostatnio zakończonych.
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Biuro zawodów otwarte teraz</h2>
              <p className="text-sm text-muted-foreground">Wydarzenia Twojej organizacji, które są aktualnie w trakcie odprawy.</p>
            </div>
            <Badge className="shrink-0" variant={activeEvents.length > 0 ? 'default' : 'secondary'}>
              {activeEvents.length} aktywne
            </Badge>
          </div>

          {activeEvents.length === 0 ? (
            <EmptyState
              title="Brak aktywnych wydarzeń"
              description="Gdy biuro zawodów będzie otwarte dla wydarzenia z Twojej organizacji, pojawi się tutaj z szybkim wejściem i statystyką odpraw."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {activeEvents.map(event => (
                <ActiveEventCard
                  key={event.id}
                  event={event}
                  organizationName={organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
                  participantsCount={participants.filter(participant => participant.event_id === event.id).length}
                  checkedInCount={participants.filter(participant => participant.event_id === event.id && participantCountsAsCheckedIn(participant)).length}
                  onOpen={() => navigate(`/events/${event.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Nadchodzące wydarzenia</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Najbliższe wydarzenia Twojej organizacji z szybkim wejściem do szczegółów.
                  </p>
                </div>
                <Badge variant="secondary">{upcomingEvents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingEvents.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Brak nadchodzących wydarzeń"
                    description="Po dodaniu kolejnych wydarzeń w Twojej organizacji zobaczysz je tutaj."
                    compact
                  />
                </div>
              ) : (
                <EventOverviewTable
                  events={upcomingEvents}
                  organizationNames={organizationNames}
                  metaColumnLabel="Start biura"
                  getMetaValue={event => formatEventOfficeStart(event)}
                  onOpen={eventId => navigate(`/events/${eventId}`)}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Ostatnio zakończone</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pięć ostatnich zakończonych wydarzeń z Twojej organizacji.
                  </p>
                </div>
                <Badge variant="outline">{finishedEvents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {finishedEvents.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Brak zakończonych wydarzeń"
                    description="Po zakończeniu wydarzeń z Twojej organizacji pojawią się tutaj."
                    compact
                  />
                </div>
              ) : (
                <EventOverviewTable
                  events={finishedEvents}
                  organizationNames={organizationNames}
                  metaColumnLabel="Zamknięto"
                  getMetaValue={event => formatEventOfficeEnd(event)}
                  onOpen={eventId => navigate(`/events/${eventId}`)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Panel</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Panel skanera dla aktualnego wydarzenia.
        </p>
      </div>

      {currentEvent && (
        <Card className="border-2">
          <CardContent className="pt-6">
            <p className="break-words text-base font-semibold sm:text-lg">{currentEvent.name}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">{currentEvent.location}</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Biuro: {formatEventOfficeWindow(currentEvent)}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Witaj! Kliknij <strong>"Przejdź do skanera"</strong>, aby rozpocząć odprawę uczestników.</p>
              <p>Możesz skanować kody QR kamerą lub wyszukać zawodnika ręcznie po nazwisku albo numerze.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="h-14 w-full gap-3 text-base touch-manipulation active:scale-[0.98] sm:h-16 sm:text-lg" onClick={() => navigate('/scanner')}>
        <ScanLine className="h-5 w-5 sm:h-6 sm:w-6" /> Przejdź do skanera
      </Button>

      <Card>
        <CardHeader><CardTitle className="text-base">Ostatnie skany</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {activityLog.filter(log => log.action === 'Check-in').slice(0, 5).map(log => (
            <div key={log.id} className="flex flex-col gap-1 py-1.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="mr-2 truncate font-medium">{log.participant_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: pl })}</span>
            </div>
          ))}
          {activityLog.filter(log => log.action === 'Check-in').length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Brak skanów - przejdź do skanera, aby rozpocząć odprawę</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveEventCard({
  event,
  organizationName,
  participantsCount,
  checkedInCount,
  onOpen,
}: {
  event: Event;
  organizationName: string;
  participantsCount: number;
  checkedInCount: number;
  onOpen: () => void;
}) {
  const progress = participantsCount ? Math.round((checkedInCount / participantsCount) * 100) : 0;

  return (
    <Card className="overflow-hidden border-primary/30 shadow-sm">
      <CardHeader className="border-b bg-primary/5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{event.name}</CardTitle>
              <Badge>Biuro otwarte</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{organizationName}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Odprawa</p>
            <p className="text-lg font-semibold tabular-nums">{checkedInCount}/{participantsCount}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{event.location}</p>
          <p className="text-sm text-muted-foreground">{formatEventOfficeWindow(event)}</p>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Postęp odpraw</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Łatwy dostęp do uczestników, maili QR i szczegółów wydarzenia.
          </div>
          <Button className="h-11 w-full gap-2 sm:h-10 sm:w-auto" onClick={onOpen}>
            Otwórz wydarzenie
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EventOverviewTable({
  events,
  organizationNames,
  metaColumnLabel,
  getMetaValue,
  onOpen,
}: {
  events: Event[];
  organizationNames: Record<string, string>;
  metaColumnLabel: string;
  getMetaValue: (event: Event) => string;
  onOpen: (eventId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Wydarzenie</TableHead>
            <TableHead className="hidden md:table-cell">Organizacja</TableHead>
            <TableHead>{metaColumnLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map(event => (
            <TableRow
              key={event.id}
              className="cursor-pointer active:bg-accent/50"
              onClick={() => onOpen(event.id)}
            >
              <TableCell>
                <div>
                  <span className="font-medium text-sm">{event.name}</span>
                  <span className="block truncate text-xs text-muted-foreground md:hidden">
                    {organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getMetaValue(event)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className={`text-center ${compact ? 'py-8' : 'py-12'}`}>
        <p className="font-medium">{title}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
