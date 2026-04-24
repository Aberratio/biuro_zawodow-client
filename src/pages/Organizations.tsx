import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { SuccessActionDialog } from '@/components/SuccessActionDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { formatEventOfficeEnd, formatEventOfficeStart, getEventOfficeCloseAt, getEventOfficeOpenAt, isEventOfficeOpen } from '@/lib/events';
import { validateNonNegativeInteger, validateRequired } from '@/lib/form-validation';
import { buildOrganizationPath } from '@/lib/routes';
import type { Event } from '@/types';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';
import { PageHeader } from '@/components/PageHeader';

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
  const {
    organizations,
    events,
    archivedEvents,
    currentRole,
    currentUser,
    createOrganization,
    isLoading,
    connectionState,
    setSelectedOrganizationId,
  } = useData();
  const [open, setOpen] = useState(false);
  const [createdOrganizationSuccess, setCreatedOrganizationSuccess] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ name: '', event_limit: '1' });
  const [errors, setErrors] = useState<{ name?: string; event_limit?: string; form?: string }>({});

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (currentRole !== 'editor') return;
    if (!currentUser.organization_id) return;
    navigate(`/organizations/${currentUser.organization_id}`, { replace: true });
  }, [currentRole, currentUser.organization_id, isLoading, navigate]);

  const visibleOrganizations = useMemo(() => {
    if (currentRole === 'superadmin') return organizations;
    if (currentRole === 'admin') return organizations;
    return organizations.filter(org => org.id === currentUser.organization_id);
  }, [currentRole, currentUser, organizations]);

  const shouldShowSearch = visibleOrganizations.length > 5;
  const normalizedQuery = shouldShowSearch ? searchQuery.trim().toLocaleLowerCase('pl-PL') : '';
  const now = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);
  const isOnline = connectionState === 'online';

  const filteredOrganizations = useMemo(() => {
    return visibleOrganizations
      .filter(org => !normalizedQuery || org.name.toLocaleLowerCase('pl-PL').includes(normalizedQuery))
      .map(org => {
        const organizationEvents = events.filter(event => event.organization_id === org.id);
        const organizationArchivedEvents = archivedEvents.filter(event => event.organization_id === org.id);

        return {
          ...org,
          eventCount: organizationEvents.length + organizationArchivedEvents.length,
          nextEventLabel: getClosestOrganizationEventLabel(organizationEvents, now),
        };
      });
  }, [archivedEvents, events, normalizedQuery, now, visibleOrganizations]);

  const openOrganization = (organizationId: string) => {
    if (currentRole === 'admin') {
      setSelectedOrganizationId(organizationId);
    }

    navigate(buildOrganizationPath(organizationId));
  };

  if (isLoading) return <TableSkeleton rows={8} cols={4} subtitle="" showFilters />;

  const handleCreate = async () => {
    const nextErrors = {
      name: validateRequired(form.name, 'Podaj nazwę organizacji.'),
      event_limit: validateNonNegativeInteger(form.event_limit, 'Podaj poprawny limit wydarzeń.'),
    };

    if (nextErrors.name || nextErrors.event_limit) {
      setErrors(nextErrors);
      return;
    }

    const parsedLimit = Number(form.event_limit);
    if (!form.name || !Number.isInteger(parsedLimit) || parsedLimit < 0) {
      setErrors(previous => ({ ...previous, form: 'Podaj nazwę i poprawny limit wydarzeń.' }));
      toast({ title: 'Nieprawidłowe dane', description: 'Podaj nazwę i poprawny limit wydarzeń.', variant: 'destructive' });
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    const result = await createOrganization({
      name: form.name,
      event_limit: parsedLimit,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setErrors({ form: result.error ?? 'Nie udało się utworzyć organizacji.' });
      toast({ title: 'Nie udało się utworzyć organizacji', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setForm({ name: '', event_limit: '1' });
    setErrors({});
    setOpen(false);
    if (result.entityId) {
      setCreatedOrganizationSuccess({
        id: result.entityId,
        name: form.name.trim(),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader className="contents" title="Organizacje" />
        {(currentRole === 'admin' || currentRole === 'superadmin') && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto" disabled={!isOnline}>
            <Plus className="mr-1 h-4 w-4" />
            Nowa organizacja
          </Button>
        )}
      </div>

      {!isOnline && (currentRole === 'admin' || currentRole === 'superadmin') && (
        <OnlineOnlyNotice description="Tworzenie i edycja organizacji wymagają aktywnego połączenia z serwerem. Lista pozostaje dostępna do odczytu z lokalnego snapshotu." />
      )}

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
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="hidden md:table-cell">Najbliższe wydarzenie</TableHead>
                    <TableHead>Wydarzenia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.map(org => (
                    <TableRow
                      key={org.id}
                      className="cursor-pointer active:bg-accent/50"
                      onClick={() => openOrganization(org.id)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openOrganization(org.id);
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) setErrors({});
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa organizacja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="organization-name">Nazwa</Label>
              <Input
                id="organization-name"
                value={form.name}
                onChange={event => {
                  setForm(prev => ({ ...prev, name: event.target.value }));
                  setErrors(prev => ({ ...prev, name: undefined, form: undefined }));
                }}
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'organization-name-error' : undefined}
              />
              <FieldError id="organization-name-error" className="mt-2">{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="organization-event-limit">Limit wydarzeń</Label>
              <Input
                id="organization-event-limit"
                type="number"
                min="0"
                value={form.event_limit}
                onChange={event => {
                  setForm(prev => ({ ...prev, event_limit: event.target.value }));
                  setErrors(prev => ({ ...prev, event_limit: undefined, form: undefined }));
                }}
                required
                aria-invalid={Boolean(errors.event_limit)}
                aria-describedby={errors.event_limit ? 'organization-event-limit-error' : undefined}
              />
              <FieldError id="organization-event-limit-error" className="mt-2">{errors.event_limit}</FieldError>
            </div>
            <FieldError id="organization-form-error">{errors.form}</FieldError>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreate}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              {isSubmitting ? "Tworzenie..." : "Utwórz organizację"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SuccessActionDialog
        open={createdOrganizationSuccess !== null}
        onOpenChange={nextOpen => {
          if (!nextOpen) {
            setCreatedOrganizationSuccess(null);
          }
        }}
        title="Organizacja utworzona pomyślnie"
        description={
          createdOrganizationSuccess
            ? `Organizacja "${createdOrganizationSuccess.name || 'Nowa organizacja'}" została utworzona.`
            : ''
        }
        primaryLabel="Przejdź do organizacji"
        secondaryLabel="Zostań na tej stronie"
        onPrimaryAction={() => {
          if (!createdOrganizationSuccess) {
            return;
          }

          openOrganization(createdOrganizationSuccess.id);
          setCreatedOrganizationSuccess(null);
        }}
        onSecondaryAction={() => setCreatedOrganizationSuccess(null)}
      />
    </div>
  );
}
