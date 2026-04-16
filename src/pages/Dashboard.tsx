import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowRight, ScanLine } from 'lucide-react';

import { useData } from '@/contexts/DataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';
import {
  formatEventOfficeStart,
  formatEventOfficeWindow,
  getEventOfficeCloseAt,
  getEventOfficeOpenAt,
  isEventOfficeOpen,
} from '@/lib/events';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';
import type { Event } from '@/types';

export default function Dashboard() {
  const {
    currentRole,
    events,
    visibleEvents,
    participants,
    activityLog,
    selectedEventId,
    isLoading,
    organizations,
  } = useData();
  const navigate = useNavigate();

  const currentEvent = visibleEvents.find((event) => event.id === selectedEventId);
  const currentEventOfficeOpen = currentEvent ? isEventOfficeOpen(currentEvent) : false;
  const dashboardEvents = currentRole === 'superadmin' ? events : visibleEvents;

  const organizationNames = useMemo(
    () => Object.fromEntries(organizations.map((organization) => [organization.id, organization.name])),
    [organizations],
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (currentRole === 'admin' || currentRole === 'superadmin' || currentRole === 'editor') {
    const now = new Date();
    const sourceEvents =
      currentRole === 'admin' || currentRole === 'superadmin' ? dashboardEvents : visibleEvents;
    const activeEvents = sourceEvents
      .filter((event) => isEventOfficeOpen(event, now))
      .sort(
        (left, right) =>
          (getEventOfficeCloseAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (getEventOfficeCloseAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER),
      );
    const upcomingEvents = sourceEvents
      .filter((event) => {
        const openAt = getEventOfficeOpenAt(event);
        return openAt !== null && openAt > now;
      })
      .sort(
        (left, right) =>
          (getEventOfficeOpenAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (getEventOfficeOpenAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER),
      );

    const activeDescription =
      currentRole === 'editor'
        ? 'Wydarzenia Twojej organizacji, które są aktualnie w trakcie odprawy.'
        : 'Wydarzenia, które są aktualnie w trakcie odprawy.';
    const activeEmptyDescription =
      currentRole === 'editor'
        ? 'Gdy biuro zawodów będzie otwarte dla wydarzenia z Twojej organizacji, pojawi się tutaj z szybkim wejściem i statystyką odpraw.'
        : 'Gdy biuro zawodów będzie otwarte dla któregoś wydarzenia, pojawi się tutaj z szybkim wejściem i statystyką odpraw.';
    const upcomingEmptyDescription =
      currentRole === 'editor'
        ? 'Po dodaniu kolejnych wydarzeń w Twojej organizacji zobaczysz je tutaj.'
        : 'Po dodaniu kolejnych zawodów zobaczysz tutaj ich uporządkowaną listę.';

    return (
      <div className="space-y-6 lg:space-y-8">
        <div className="space-y-1.5">
          <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[2.55rem]">
            Panel
          </h1>
        </div>

        <section className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-[1.25rem] font-semibold tracking-[-0.03em] text-[hsl(var(--button-highlight))] sm:text-[1.55rem]">
              Biuro zawodów otwarte teraz
            </h2>
            <p className="max-w-2xl text-[0.92rem] leading-6 text-muted-foreground sm:text-[0.98rem] sm:leading-7">
              {activeDescription}
            </p>
          </div>

          {activeEvents.length === 0 ? (
            <EmptyState
              title="Brak aktywnych wydarzeń"
              description={activeEmptyDescription}
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {activeEvents.map((event) => (
                <ActiveEventCard
                  key={event.id}
                  event={event}
                  organizationName={organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
                  participantsCount={participants.filter((participant) => participant.event_id === event.id).length}
                  checkedInCount={
                    participants.filter(
                      (participant) =>
                        participant.event_id === event.id &&
                        participantCountsAsCheckedIn(participant),
                    ).length
                  }
                  onOpen={() => navigate(`/events/${event.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <Card className="overflow-hidden rounded-[1.8rem] border-[hsl(var(--primary)/0.2)] bg-[radial-gradient(circle_at_top_right,hsl(var(--button-highlight)/0.08),transparent_26%),linear-gradient(180deg,hsl(220_10%_11%/0.95),hsl(220_14%_7%/0.98))] shadow-[0_30px_70px_hsl(var(--surface-shadow)/0.42)] sm:rounded-[2rem]">
          <CardHeader className="border-b border-white/6 px-5 py-4.5 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-[1.18rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.3rem]">
                  Nadchodzące wydarzenia
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingEvents.length === 0 ? (
              <div className="p-5 sm:p-6">
                <EmptyState
                  title="Brak nadchodzących wydarzeń"
                  description={upcomingEmptyDescription}
                  compact
                />
              </div>
            ) : (
              <EventOverviewTable
                events={upcomingEvents}
                organizationNames={organizationNames}
                metaColumnLabel="Start biura"
                getMetaValue={(event) => formatEventOfficeStart(event)}
                onOpen={(eventId) => navigate(`/events/${eventId}`)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <div className="space-y-6 lg:space-y-8">
        <div className="space-y-1.5">
          <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[2.55rem]">
            Panel
          </h1>
        </div>

      {currentEvent && (
        <Card className="overflow-hidden rounded-[1.8rem] border-[hsl(var(--primary)/0.22)] bg-[radial-gradient(circle_at_top_right,hsl(var(--button-highlight)/0.08),transparent_28%),linear-gradient(180deg,hsl(220_10%_11%/0.95),hsl(220_14%_7%/0.98))] sm:rounded-[2rem]">
          <CardContent className="space-y-2 px-5 py-4.5 sm:px-6 sm:py-5">
            <p className="break-words text-[1.3rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.55rem]">
              {currentEvent.name}
            </p>
            <p className="text-sm text-muted-foreground sm:text-base">{currentEvent.location}</p>
            <p className="text-sm text-muted-foreground sm:text-base">
              Biuro: {formatEventOfficeWindow(currentEvent)}
            </p>
          </CardContent>
        </Card>
      )}

      {currentEvent && !currentEventOfficeOpen && (
        <Card className="border-dashed border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--accent)/0.35)]">
          <CardContent className="py-4 text-sm leading-7 text-muted-foreground">
            Skaner jest dostępny tylko w godzinach otwarcia biura zawodów dla wybranego wydarzenia.
          </CardContent>
        </Card>
      )}

      {currentEventOfficeOpen && (
        <Button
          size="lg"
          className="h-14 w-full rounded-[1.35rem] gap-3 text-base touch-manipulation active:scale-[0.98] sm:h-16 sm:text-lg"
          onClick={() => navigate('/scanner')}
        >
          <ScanLine className="h-5 w-5 sm:h-6 sm:w-6" />
          Przejdź do skanera
        </Button>
      )}

      <Card className="overflow-hidden rounded-[1.8rem] border-[hsl(var(--primary)/0.18)] bg-[linear-gradient(180deg,hsl(220_10%_11%/0.95),hsl(220_14%_7%/0.98))] sm:rounded-[2rem]">
        <CardHeader className="border-b border-white/6 px-5 py-4.5 sm:px-6 sm:py-5">
          <CardTitle className="text-[1.15rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.25rem]">
            Ostatnie skany
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-5 py-4 sm:px-7">
          {activityLog
            .filter((log) => log.action === 'Check-in')
            .slice(0, 5)
            .map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 rounded-[1.15rem] border border-white/6 bg-white/[0.015] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="mr-2 truncate font-medium text-foreground">{log.participant_name}</span>
                <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: pl })}
                </span>
              </div>
            ))}
          {activityLog.filter((log) => log.action === 'Check-in').length === 0 && (
            <p className="py-6 text-center text-sm leading-7 text-muted-foreground">
              {currentEventOfficeOpen
                ? 'Brak skanów. Przejdź do skanera, aby rozpocząć odprawę.'
                : 'Brak skanów dla aktualnego zakresu.'}
            </p>
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
    <Card className="overflow-hidden rounded-[1.55rem] border border-[hsl(var(--button-highlight)/0.18)] bg-[radial-gradient(circle_at_top,hsl(var(--button-highlight)/0.13),transparent_22%),linear-gradient(180deg,hsl(220_11%_13%/0.98),hsl(220_14%_8%/0.99))] shadow-[0_18px_46px_hsl(var(--surface-shadow)/0.5),0_0_0_1px_hsl(var(--button-highlight)/0.05),inset_0_1px_0_hsl(var(--foreground)/0.05)] sm:rounded-[1.7rem]">
      <CardHeader className="border-b border-[hsl(var(--foreground)/0.05)] px-4 py-4 sm:px-5 sm:py-[1.125rem]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="text-[1.18rem] font-semibold tracking-[-0.045em] text-[hsl(40_24%_94%)] sm:text-[1.32rem]">
                {event.name}
              </CardTitle>
              <Badge className="rounded-full border border-emerald-400/14 bg-emerald-500/10 px-2.5 py-0.5 text-[0.68rem] font-medium text-emerald-200/90 shadow-none hover:bg-emerald-500/10">
                Biuro otwarte
              </Badge>
            </div>
            <p className="text-[0.82rem] text-[hsl(35_12%_72%/0.82)] sm:text-[0.9rem]">{organizationName}</p>
          </div>
          <div className="min-w-[5.5rem] rounded-[0.95rem] border border-[hsl(var(--button-highlight)/0.14)] bg-[linear-gradient(180deg,hsl(var(--button-highlight)/0.08),transparent_30%),hsl(220_12%_10%/0.88)] px-3 py-2 text-right shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] sm:min-w-[5.8rem] sm:rounded-[1.05rem]">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-[hsl(40_76%_62%)]">
              Odprawa
            </p>
            <p className="mt-1 text-[1.65rem] font-semibold leading-none tracking-[-0.06em] text-[hsl(40_24%_96%)] tabular-nums sm:text-[1.82rem]">
              {checkedInCount}/{participantsCount}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4 sm:px-5 sm:py-[1.125rem]">
        <div className="space-y-2.5">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[hsl(40_18%_64%/0.72)]">
            Lokalizacja
          </p>
          <p className="text-[0.92rem] leading-6 text-[hsl(40_18%_88%/0.88)] sm:text-[0.96rem]">{event.location}</p>
          <p className="pt-1.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[hsl(40_18%_64%/0.72)]">
            Godziny biura
          </p>
          <p className="text-[0.96rem] leading-6 text-[hsl(40_24%_94%)] sm:text-[1rem]">{formatEventOfficeWindow(event)}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.84rem] font-medium text-[hsl(35_14%_74%/0.84)]">Postep odpraw</span>
            <span className="text-[0.92rem] font-semibold text-[hsl(40_24%_94%)]">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(220_12%_16%)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(40_80%_64%),hsl(40_64%_46%))] shadow-[0_0_14px_hsl(var(--button-highlight)/0.24)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button className="h-10 rounded-[0.95rem] border-[hsl(var(--button-highlight)/0.3)] px-[1.125rem] text-[0.9rem] font-semibold text-[hsl(39_28%_96%)] shadow-[0_12px_28px_hsl(var(--surface-shadow)/0.34),inset_0_1px_0_hsl(var(--foreground)/0.08)]" onClick={onOpen}>
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
      <Table
        className="min-w-0 md:min-w-[42rem]"
        containerClassName="rounded-none border-0 bg-transparent shadow-none backdrop-blur-0"
      >
        <TableHeader>
          <TableRow className="border-white/6 bg-transparent hover:bg-transparent">
            <TableHead className="h-13 px-5 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/78 sm:px-6 sm:text-[0.72rem] sm:tracking-[0.2em]">
              Wydarzenie
            </TableHead>
            <TableHead className="hidden h-13 px-6 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/78 md:table-cell">
              Organizacja
            </TableHead>
            <TableHead className="h-13 px-5 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/78 sm:px-6 sm:text-[0.72rem] sm:tracking-[0.2em]">
              {metaColumnLabel}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow
              key={event.id}
              className="cursor-pointer border-white/6 bg-transparent transition-colors hover:bg-[hsl(var(--button-highlight)/0.05)] active:bg-[hsl(var(--button-highlight)/0.08)]"
              onClick={() => onOpen(event.id)}
            >
              <TableCell className="px-5 py-3.5 sm:px-6 sm:py-4.5">
                <div>
                  <span className="text-[0.92rem] font-semibold text-foreground sm:text-[0.98rem]">{event.name}</span>
                  <span className="mt-0.5 block truncate text-[0.84rem] text-muted-foreground md:hidden">
                    {organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden px-6 py-4.5 text-[0.92rem] text-muted-foreground md:table-cell">
                {organizationNames[event.organization_id] ?? 'Nieznana organizacja'}
              </TableCell>
              <TableCell className="px-5 py-3.5 text-[0.9rem] text-foreground/88 sm:px-6 sm:py-4.5 sm:text-[0.96rem]">
                {getMetaValue(event)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <Card className="rounded-[1.8rem] border-dashed border-[hsl(var(--primary)/0.2)] bg-[linear-gradient(180deg,hsl(220_10%_11%/0.86),hsl(220_13%_8%/0.94))] sm:rounded-[2rem]">
      <CardContent className={`text-center ${compact ? 'py-8' : 'py-9 sm:py-10'} px-5 sm:px-8`}>
        <p className="text-[1.02rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.1rem]">{title}</p>
        <p className="mx-auto mt-2.5 max-w-2xl text-[0.9rem] leading-6 text-muted-foreground sm:text-[0.96rem] sm:leading-7">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
