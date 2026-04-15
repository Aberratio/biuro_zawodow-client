import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListFilter, Plus } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EventsSkeleton from '@/components/skeletons/EventsSkeleton';
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeWindow, getEventOfficeOpenAt, isEventOfficeOpen, isValidEventOfficeRange } from '@/lib/events';
import { validateRequired } from '@/lib/form-validation';
import { isScannerRole } from '@/lib/roles';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';

const EVENTS_PAGE_SIZE = 20;

type EventStatusFilter = 'all' | 'active' | 'upcoming' | 'finished';
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

function scrollAppContentToTop() {
  const scrollRoot = document.querySelector<HTMLElement>('[data-app-scroll-root="true"]');
  scrollRoot?.scrollTo({ top: 0 });
}

export default function Events() {
  const {
    visibleEvents,
    organizations,
    createEvent,
    currentUser,
    currentRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
    isLoading,
    connectionState,
  } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const adminOrganizationIds = useMemo(() => currentUser.organization_ids ?? [], [currentUser.organization_ids]);
  const adminOrganizations = useMemo(
    () => organizations.filter(org => adminOrganizationIds.includes(org.id)),
    [adminOrganizationIds, organizations],
  );
  const organizationNames = useMemo(
    () => Object.fromEntries(organizations.map(org => [org.id, org.name])),
    [organizations],
  );
  const canCreateEvent = !isScannerRole(currentRole);
  const isOnline = connectionState === 'online';
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
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    location?: string;
    organization_id?: string;
    office_open_at?: string;
    office_close_at?: string;
    form?: string;
  }>({});

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
  }, [searchQuery, selectedOrganizationId, statusFilter]);
  const scopedEvents = useMemo(
    () => currentRole === 'admin'
      ? visibleEvents.filter(event => event.organization_id === selectedOrganizationId)
      : visibleEvents,
    [currentRole, selectedOrganizationId, visibleEvents],
  );
  const eventRows = useMemo(() => {
    const now = new Date();

    return scopedEvents.map(event => {
      const officeOpenAt = getEventOfficeOpenAt(event);
      return {
        ...event,
        organizationName: organizationNames[event.organization_id] ?? 'Nieznana organizacja',
        timingStatus: getEventTimingStatus(event, now),
        officeOpenAtTimestamp: officeOpenAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    });
  }, [organizationNames, scopedEvents]);
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

    return [...filtered].sort((left, right) =>
      left.officeOpenAtTimestamp - right.officeOpenAtTimestamp || left.name.localeCompare(right.name, 'pl')
    );
  }, [eventRows, searchQuery, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(processedRows.length / EVENTS_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!shouldShowFiltersAndPagination || totalPages <= 1) {
      return;
    }

    scrollAppContentToTop();
  }, [currentPage, shouldShowFiltersAndPagination, totalPages]);

  const paginatedRows = useMemo(() => {
    if (!shouldShowFiltersAndPagination) {
      return processedRows;
    }

    const startIndex = (currentPage - 1) * EVENTS_PAGE_SIZE;
    return processedRows.slice(startIndex, startIndex + EVENTS_PAGE_SIZE);
  }, [currentPage, processedRows, shouldShowFiltersAndPagination]);
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
    const nextErrors = {
      name: validateRequired(form.name, 'Podaj nazwę wydarzenia.'),
      location: validateRequired(form.location, 'Podaj lokalizację wydarzenia.'),
      organization_id: validateRequired(form.organization_id, 'Wybierz organizację.'),
      office_open_at: validateRequired(form.office_open_at, 'Podaj datę i godzinę otwarcia biura.'),
      office_close_at: validateRequired(form.office_close_at, 'Podaj datę i godzinę zamknięcia biura.'),
    };

    if (nextErrors.name || nextErrors.location || nextErrors.organization_id || nextErrors.office_open_at || nextErrors.office_close_at) {
      setFormErrors(nextErrors);
      return;
    }

    if (!form.office_open_at || !form.office_close_at || !isValidEventOfficeRange(form.office_open_at, form.office_close_at)) {
      setFormErrors({ office_close_at: 'Zamknięcie biura musi być później niż otwarcie.' });
      toast({
        title: 'Nieprawidłowe godziny biura',
        description: 'Podaj wymaganą datę i godzinę otwarcia oraz zamknięcia biura zawodów. Otwarcie musi być wcześniejsze od zamknięcia.',
        variant: 'destructive',
      });
      return;
    }

    setFormErrors({});
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
      setFormErrors({ form: result.error ?? 'Nie udało się utworzyć wydarzenia.' });
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
    setFormErrors({});
    setOpen(false);
    toast({ title: 'Wydarzenie utworzone' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Wydarzenia</h1>
        </div>
        {canCreateEvent && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto" disabled={!isOnline}>
            <Plus className="mr-1 h-4 w-4" /> Nowe wydarzenie
          </Button>
        )}
      </div>

      {!isOnline && canCreateEvent && (
        <OnlineOnlyNotice description="Tworzenie i edycja wydarzen wymagaja aktywnego polaczenia z serwerem. Lista wydarzen pozostaje dostepna do odczytu z lokalnego snapshotu." />
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

          <div className="min-w-[16rem] flex-1 space-y-2">
            <Label htmlFor="events-search">Szukaj</Label>
            <Input
              id="events-search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Nazwa, lokalizacja lub organizacja"
              className="text-sm"
            />
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
        </div>
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
          <div className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  {showOrganizationColumn && <TableHead className="hidden lg:table-cell">Organizacja</TableHead>}
                  <TableHead className="hidden md:table-cell">Lokalizacja</TableHead>
                  <TableHead>Biuro</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
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

      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) setFormErrors({});
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nowe wydarzenie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(currentRole === 'superadmin' || currentRole === 'admin') && (
              <div>
                <Label htmlFor="event-create-organization">Organizacja</Label>
                <Select
                  value={form.organization_id}
                  onValueChange={value => {
                    setForm(current => ({ ...current, organization_id: value }));
                    setFormErrors(current => ({ ...current, organization_id: undefined, form: undefined }));
                  }}
                >
                  <SelectTrigger
                    id="event-create-organization"
                    aria-invalid={Boolean(formErrors.organization_id)}
                    aria-describedby={formErrors.organization_id ? 'event-create-organization-error' : undefined}
                  >
                    <SelectValue placeholder="Wybierz organizację" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations
                      .filter(org => currentRole === 'superadmin' || adminOrganizationIds.includes(org.id))
                      .map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FieldError id="event-create-organization-error" className="mt-2">{formErrors.organization_id}</FieldError>
              </div>
            )}
            <div>
              <Label htmlFor="event-create-name">Nazwa</Label>
              <Input
                id="event-create-name"
                value={form.name}
                onChange={event => {
                  setForm(current => ({ ...current, name: event.target.value }));
                  setFormErrors(current => ({ ...current, name: undefined, form: undefined }));
                }}
                placeholder="np. Bieg Wiosenny"
                required
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? 'event-create-name-error' : undefined}
              />
              <FieldError id="event-create-name-error" className="mt-2">{formErrors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="event-create-location">Lokalizacja</Label>
              <Input
                id="event-create-location"
                value={form.location}
                onChange={event => {
                  setForm(current => ({ ...current, location: event.target.value }));
                  setFormErrors(current => ({ ...current, location: undefined, form: undefined }));
                }}
                placeholder="np. Kraków, Błonia"
                required
                aria-invalid={Boolean(formErrors.location)}
                aria-describedby={formErrors.location ? 'event-create-location-error' : undefined}
              />
              <FieldError id="event-create-location-error" className="mt-2">{formErrors.location}</FieldError>
            </div>
            <div>
              <Label htmlFor="event-create-office-open">Data i godzina otwarcia biura zawodów</Label>
              <DateTimePicker
                id="event-create-office-open"
                value={form.office_open_at}
                onChange={value => {
                  setForm(current => ({ ...current, office_open_at: value }));
                  setFormErrors(current => ({ ...current, office_open_at: undefined, office_close_at: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(formErrors.office_open_at)}
                aria-describedby={formErrors.office_open_at ? 'event-create-office-open-error' : undefined}
              />
              <FieldError id="event-create-office-open-error" className="mt-2">{formErrors.office_open_at}</FieldError>
            </div>
            <div>
              <Label htmlFor="event-create-office-close">Data i godzina zamknięcia biura zawodów</Label>
              <DateTimePicker
                id="event-create-office-close"
                value={form.office_close_at}
                onChange={value => {
                  setForm(current => ({ ...current, office_close_at: value }));
                  setFormErrors(current => ({ ...current, office_close_at: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(formErrors.office_close_at)}
                aria-describedby={formErrors.office_close_at ? 'event-create-office-close-error' : undefined}
              />
              <FieldError id="event-create-office-close-error" className="mt-2">{formErrors.office_close_at}</FieldError>
            </div>
            {formOrganization && (
              <p className="text-[10px] text-muted-foreground">
                Limit organizacji: {formOrganizationUsedSlots}/{formOrganization.event_limit} wydarzeń.
              </p>
            )}
            <FieldError id="event-create-form-error">{formErrors.form}</FieldError>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={(formOrganization ? formOrganizationUsedSlots >= formOrganization.event_limit : false) || isSubmitting}
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
