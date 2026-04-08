import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ListFilter, Plus, Search } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EventsSkeleton from '@/components/skeletons/EventsSkeleton';
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeWindow, getEventOfficeOpenAt, isEventOfficeOpen, isValidEventOfficeRange } from '@/lib/events';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';

const EVENTS_PAGE_SIZE = 20;

type EventStatusFilter = 'all' | 'active' | 'upcoming' | 'finished';
type EventSortOption = 'office_open_asc' | 'office_open_desc' | 'name_asc' | 'name_desc' | 'attendance_desc';

type EventTimingStatus = Exclude<EventStatusFilter, 'all'>;

function getEventTimingStatus(event: { office_open_at: string; office_close_at: string }, now: Date): EventTimingStatus {
  if (isEventOfficeOpen(event, now)) {
    return 'active';
  }

  const openAt = getEventOfficeOpenAt(event);
  if (openAt && now < openAt) {
    return 'upcoming';
  }

  const closeAt = new Date(event.office_close_at.includes(' ') ? event.office_close_at.replace(' ', 'T') : event.office_close_at);
  if (!Number.isNaN(closeAt.getTime()) && now > closeAt) {
    return 'finished';
  }

  return 'upcoming';
}

function buildPaginationModel(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>('all');
  const [sortBy, setSortBy] = useState<EventSortOption>('office_open_asc');
  const [currentPage, setCurrentPage] = useState(1);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedOrganizationId, sortBy, statusFilter]);

  const pageOrganizationId = currentRole === 'admin'
    ? selectedOrganizationId
    : currentUser.organization_id || '';
  const pageOrganization = useMemo(
    () => organizations.find(org => org.id === pageOrganizationId),
    [organizations, pageOrganizationId],
  );
  const scopedEvents = useMemo(
    () => currentRole === 'admin'
      ? visibleEvents.filter(event => event.organization_id === selectedOrganizationId)
      : visibleEvents,
    [currentRole, selectedOrganizationId, visibleEvents],
  );
  const participantStatsByEventId = useMemo(() => {
    return participants.reduce<Record<string, { participantCount: number; checkedInCount: number }>>((accumulator, participant) => {
      const current = accumulator[participant.event_id] ?? { participantCount: 0, checkedInCount: 0 };
      current.participantCount += 1;
      if (participantCountsAsCheckedIn(participant)) {
        current.checkedInCount += 1;
      }
      accumulator[participant.event_id] = current;
      return accumulator;
    }, {});
  }, [participants]);
  const eventRows = useMemo(() => {
    const now = new Date();

    return scopedEvents.map(event => {
      const participantStats = participantStatsByEventId[event.id] ?? { participantCount: 0, checkedInCount: 0 };
      const officeOpenAt = getEventOfficeOpenAt(event);
      return {
        ...event,
        checkedInCount: participantStats.checkedInCount,
        participantCount: participantStats.participantCount,
        organizationName: organizationNames[event.organization_id] ?? 'Nieznana organizacja',
        timingStatus: getEventTimingStatus(event, now),
        officeOpenAtTimestamp: officeOpenAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    });
  }, [organizationNames, participantStatsByEventId, scopedEvents]);
  const shouldShowFiltersAndPagination = eventRows.length > EVENTS_PAGE_SIZE;
  const processedRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = eventRows.filter(event => {
      const matchesQuery = !normalizedQuery
        || event.name.toLowerCase().includes(normalizedQuery)
        || event.location.toLowerCase().includes(normalizedQuery)
        || event.organizationName.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || event.timingStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((left, right) => {
      switch (sortBy) {
        case 'name_asc':
          return left.name.localeCompare(right.name, 'pl');
        case 'name_desc':
          return right.name.localeCompare(left.name, 'pl');
        case 'office_open_desc':
          return right.officeOpenAtTimestamp - left.officeOpenAtTimestamp;
        case 'attendance_desc':
          return right.checkedInCount - left.checkedInCount || right.participantCount - left.participantCount || left.name.localeCompare(right.name, 'pl');
        case 'office_open_asc':
        default:
          return left.officeOpenAtTimestamp - right.officeOpenAtTimestamp;
      }
    });
  }, [eventRows, searchQuery, sortBy, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(processedRows.length / EVENTS_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    if (!shouldShowFiltersAndPagination) {
      return processedRows;
    }

    const startIndex = (currentPage - 1) * EVENTS_PAGE_SIZE;
    return processedRows.slice(startIndex, startIndex + EVENTS_PAGE_SIZE);
  }, [currentPage, processedRows, shouldShowFiltersAndPagination]);
  const usedSlots = scopedEvents.length;
  const remainingSlots = pageOrganization ? Math.max(pageOrganization.event_limit - usedSlots, 0) : 0;
  const usageProgress = pageOrganization && pageOrganization.event_limit > 0
    ? Math.min((usedSlots / pageOrganization.event_limit) * 100, 100)
    : 0;
  const formOrganization = useMemo(
    () => organizations.find(org => org.id === form.organization_id),
    [form.organization_id, organizations],
  );
  const formOrganizationUsedSlots = useMemo(
    () => visibleEvents.filter(event => event.organization_id === form.organization_id).length,
    [form.organization_id, visibleEvents],
  );
  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== 'all';
  const paginationModel = useMemo(() => buildPaginationModel(currentPage, totalPages), [currentPage, totalPages]);

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
            Lista wydarzeń, kontrola limitu organizacji oraz szybki dostęp do szczegółów biura zawodów.
          </p>
        </div>
        {canCreateEvent && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto">
            <Plus className="mr-1 h-4 w-4" /> Nowe wydarzenie
          </Button>
        )}
      </div>

      {pageOrganization && (
        <Card className="border-white/10 bg-white/[0.03] shadow-[0_18px_42px_hsl(var(--surface-shadow)/0.24)]">
          <CardContent className="space-y-4 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-foreground/55">
                  Limit wydarzeń
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">{pageOrganization.name}</h2>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[11px] text-foreground/75">
                    {usedSlots}/{pageOrganization.event_limit}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {remainingSlots > 0
                    ? `Możesz dodać jeszcze ${remainingSlots} ${remainingSlots === 1 ? 'wydarzenie' : 'wydarzeń'}.`
                    : 'Limit został wykorzystany. Aby dodać kolejne wydarzenie, zwiększ limit w organizacji.'}
                </p>
              </div>

              <div className="min-w-[12rem] rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-foreground/50">Pozostały zapas</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{remainingSlots}</p>
                <p className="mt-1 text-xs text-muted-foreground">wolnych slotów na wydarzenia</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Wykorzystanie limitu</span>
                <span>{Math.round(usageProgress)}%</span>
              </div>
              <Progress value={usageProgress} className="h-2.5 rounded-full bg-white/8 [&>div]:bg-[linear-gradient(90deg,hsl(var(--primary)/0.82),hsl(var(--button-highlight)/0.45))]" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {currentRole === 'admin' && adminOrganizations.length > 0 && (
            <div className="min-w-[15rem] max-w-md space-y-2">
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

          {shouldShowFiltersAndPagination && (
            <>
              <div className="min-w-[16rem] flex-1 space-y-2">
                <Label htmlFor="events-search">Szukaj</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="events-search"
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Nazwa, lokalizacja lub organizacja"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="min-w-[13rem] space-y-2">
                <Label htmlFor="events-status-filter" className="inline-flex items-center gap-2">
                  <ListFilter className="h-3.5 w-3.5" />
                  Filtr
                </Label>
                <Select value={statusFilter} onValueChange={value => setStatusFilter(value as EventStatusFilter)}>
                  <SelectTrigger id="events-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie wydarzenia</SelectItem>
                    <SelectItem value="active">Biuro otwarte teraz</SelectItem>
                    <SelectItem value="upcoming">Nadchodzące</SelectItem>
                    <SelectItem value="finished">Zakończone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {eventRows.length > 0 && (
          <div className="min-w-[14rem] space-y-2">
            <Label htmlFor="events-sort" className="inline-flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sortowanie
            </Label>
            <Select value={sortBy} onValueChange={value => setSortBy(value as EventSortOption)}>
              <SelectTrigger id="events-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office_open_asc">Biuro: najbliższy termin</SelectItem>
                <SelectItem value="office_open_desc">Biuro: najdalszy termin</SelectItem>
                <SelectItem value="name_asc">Nazwa: A-Z</SelectItem>
                <SelectItem value="name_desc">Nazwa: Z-A</SelectItem>
                <SelectItem value="attendance_desc">Odprawieni: malejąco</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {processedRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {hasActiveFilters ? 'Brak wydarzeń spełniających wybrane kryteria.' : 'Brak wydarzeń dla aktualnego zakresu.'}
            </p>
            {hasActiveFilters && (
              <p className="mt-1 text-xs text-muted-foreground/70">Spróbuj zmienić filtry lub wyszukać inną frazę.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
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
                {paginatedRows.map(event => (
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {shouldShowFiltersAndPagination
                ? `Pokazano ${processedRows.length} z ${eventRows.length} wydarzeń`
                : `${processedRows.length} wydarzeń`}
            </p>

            {shouldShowFiltersAndPagination && totalPages > 1 && (
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={event => {
                        event.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-40' : ''}
                    />
                  </PaginationItem>

                  {paginationModel.map((item, index) => (
                    <PaginationItem key={`${item}-${index}`}>
                      {item === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          isActive={item === currentPage}
                          onClick={event => {
                            event.preventDefault();
                            setCurrentPage(item);
                          }}
                        >
                          {item}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={event => {
                        event.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-40' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
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
