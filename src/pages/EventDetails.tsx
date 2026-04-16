import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
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
import { FieldError } from '@/components/ui/field-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Archive, ArrowLeft, Calendar, ChevronDown, Download, FileUp, Loader2, Mail, MapPin, Pencil, Plus, ScanLine, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import { ParticipantFieldMapping, User } from '@/types';
import { formatEventOfficeEnd, formatEventOfficeStart, formatEventOfficeWindow, getEventOfficeCloseAt, getEventOfficeOpenAt, isEventOfficeOpen, isValidEventOfficeRange } from '@/lib/events';
import { buildEmptyParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';
import { validateEmail, validateRequired } from '@/lib/form-validation';
import { isScannerRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';

type OfficeStatusTone = 'open' | 'upcoming' | 'closed';

interface OfficeStatusSummary {
  tone: OfficeStatusTone;
  badgeLabel: string;
  headline: string;
  detail: string;
  timingLabel: string;
  timingValue: string;
}

function getOfficeStatusSummary(eventOffice: { office_open_at: string; office_close_at: string }, now: Date): OfficeStatusSummary {
  const openAt = getEventOfficeOpenAt(eventOffice);
  const closeAt = getEventOfficeCloseAt(eventOffice);

  if (!openAt || !closeAt) {
    return {
      tone: 'closed',
      badgeLabel: 'Brak godzin',
      headline: 'Godziny pracy biura nie są ustawione poprawnie.',
      detail: 'Uzupełnij datę i godzinę otwarcia oraz zamknięcia, aby zespół wiedział, kiedy obsługiwać uczestników.',
      timingLabel: 'Zakres',
      timingValue: 'Brak danych',
    };
  }

  if (isEventOfficeOpen(eventOffice, now)) {
    return {
      tone: 'open',
      badgeLabel: 'Biuro otwarte',
      headline: `Biuro pracuje jeszcze przez ${formatDistanceToNowStrict(closeAt, { addSuffix: false, locale: pl })}.`,
      detail: `Uczestnicy mogą być teraz odprawiani. Biuro zamyka się ${formatEventOfficeEnd(eventOffice)}.`,
      timingLabel: 'Zamknięcie',
      timingValue: formatEventOfficeEnd(eventOffice),
    };
  }

  if (now < openAt) {
    return {
      tone: 'upcoming',
      badgeLabel: 'Biuro przed otwarciem',
      headline: `Biuro otworzy się za ${formatDistanceToNowStrict(openAt, { addSuffix: false, locale: pl })}.`,
      detail: `Zespół zacznie pracę ${formatEventOfficeStart(eventOffice)}. Do tego czasu operatorzy nie zobaczą aktywnego wydarzenia.`,
      timingLabel: 'Otwarcie',
      timingValue: formatEventOfficeStart(eventOffice),
    };
  }

  return {
    tone: 'closed',
    badgeLabel: 'Biuro zamknięte',
    headline: `Biuro zakończyło pracę ${formatDistanceToNowStrict(closeAt, { addSuffix: true, locale: pl })}.`,
    detail: 'Odprawa dla tego wydarzenia została już zamknięta. Nadal możesz sprawdzić dane, eksporty i skład zespołu.',
    timingLabel: 'Zamknięcie',
    timingValue: formatEventOfficeEnd(eventOffice),
  };
}

function getOfficeToneClasses(tone: OfficeStatusTone) {
  if (tone === 'open') {
    return {
      status: 'event-detail-status-open',
    };
  }

  if (tone === 'upcoming') {
    return {
      status: 'event-detail-status-upcoming',
    };
  }

  return {
    status: 'event-detail-status-closed',
  };
}

function TeamMemberRow({ user }: { user: User }) {
  return (
    <div className="event-detail-member-row">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className={cn('event-detail-list-section', className)}>
        <CollapsibleTrigger className="event-detail-collapsible-trigger w-full">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <ChevronDown className="event-detail-collapsible-chevron h-4 w-4 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="event-detail-collapsible-content">
          <div className="event-detail-list-content space-y-3">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TeamRoleCard({
  title,
  users,
  emptyText,
  action,
  defaultOpen = false,
}: {
  title: string;
  users: User[];
  emptyText: string;
  action?: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <CollapsibleSection title={title} defaultOpen={defaultOpen}>
      {action ? <div className="flex justify-end">{action}</div> : null}
      {users.length === 0 ? (
        <div className="event-detail-empty-state px-4 py-5 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        users.map(user => <TeamMemberRow key={user.id} user={user} />)
      )}
    </CollapsibleSection>
  );
}

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    events,
    archivedEvents,
    participants,
    users,
    currentRole,
    currentUser,
    setSelectedEventId,
    isLoading,
    getParticipantFieldMappings,
    addParticipantManually,
    assignScannerEvents,
    updateEvent,
    deleteEvent,
    exportEventCsv,
    exportEventLogsCsv,
    connectionState,
  } = useData();
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [scannerSelection, setScannerSelection] = useState<string[]>([]);
  const [scannerSaving, setScannerSaving] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualErrors, setManualErrors] = useState<{ email?: string; fields: Record<string, string>; form?: string }>({ fields: {} });
  const [manualSaving, setManualSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<{
    name?: string;
    location?: string;
    office_open_at?: string;
    office_close_at?: string;
    form?: string;
  }>({});
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingLogsCsv, setExportingLogsCsv] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [editForm, setEditForm] = useState({
    name: '',
    location: '',
    office_open_at: '',
    office_close_at: '',
  });

  const event = events.find(entry => entry.id === id) ?? archivedEvents.find(entry => entry.id === id);
  const isArchivedEvent = Boolean(event?.archived_at);
  const eventParticipants = participants.filter(participant => participant.event_id === id);
  const checkedIn = eventParticipants.filter(participantCountsAsCheckedIn).length;
  const activeMappings = useMemo(() => getActiveParticipantMappings(mappings), [mappings]);
  const organizationScanners = useMemo(
    () => users.filter(user => isScannerRole(user.role) && user.organization_id === event?.organization_id),
    [event?.organization_id, users],
  );
  const assignedScanners = useMemo(
    () => organizationScanners.filter(scanner => scanner.assigned_events.includes(event?.id ?? '')),
    [event?.id, organizationScanners],
  );
  const organizationEditors = useMemo(
    () => users.filter(user => user.role === 'editor' && user.organization_id === event?.organization_id),
    [event?.organization_id, users],
  );
  const organizationAdmins = useMemo(
    () => users.filter(user => user.role === 'admin' && (user.organization_ids ?? []).includes(event?.organization_id ?? '')),
    [event?.organization_id, users],
  );
  const canManageScanners = useMemo(() => {
    if (!event) return false;
    if (currentRole === 'superadmin') return true;
    if (currentRole === 'admin') return (currentUser.organization_ids ?? []).includes(event.organization_id);
    if (currentRole === 'editor') return currentUser.organization_id === event.organization_id;
    return false;
  }, [currentRole, currentUser, event]);
  const canEditEvent = isArchivedEvent ? currentRole === 'superadmin' : canManageScanners;
  const canOperateOnEvent = !isArchivedEvent || currentRole === 'superadmin';
  const canUseActiveEventTools = !isArchivedEvent && event !== undefined && isEventOfficeOpen(event, new Date(nowTimestamp));
  const isOnline = connectionState === 'online';

  useEffect(() => {
    if (id && events.some(entry => entry.id === id)) {
      setSelectedEventId(id);
    }
  }, [events, id, setSelectedEventId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!id || !isOnline) return;

    getParticipantFieldMappings(id)
      .then(data => {
        setMappings(data);
        setManualFields(buildEmptyParticipantFieldValues(data));
      })
      .catch(() => {
        setMappings([]);
        setManualFields({});
      });
  }, [getParticipantFieldMappings, id, isOnline]);

  useEffect(() => {
    if (!event) return;

    setEditForm({
      name: event.name,
      location: event.location,
      office_open_at: event.office_open_at.slice(0, 16),
      office_close_at: event.office_close_at.slice(0, 16),
    });
  }, [event]);

  if (isLoading) return <DetailSkeleton />;
  if (!event) return <div className="py-12 text-center text-muted-foreground">Nie znaleziono wydarzenia</div>;

  const hasSavedMapping = mappings.length > 0;
  const now = new Date(nowTimestamp);
  const officeStatus = getOfficeStatusSummary(event, now);
  const officeToneClasses = getOfficeToneClasses(officeStatus.tone);
  const hasAnyTeamMembers = organizationAdmins.length > 0 || organizationEditors.length > 0 || assignedScanners.length > 0;
  const officeCloseAt = getEventOfficeCloseAt(event);
  const isFinishedEvent = officeCloseAt !== null && now > officeCloseAt;
  const canArchiveEvent = canEditEvent && !isArchivedEvent && officeCloseAt !== null && now > officeCloseAt;
  const canAssignScannersToEvent = !isArchivedEvent && officeCloseAt !== null && now <= officeCloseAt;

  const handleManualFieldChange = (alias: string, value: string) => {
    setManualFields(previous => ({ ...previous, [alias]: value }));
    setManualErrors(previous => ({ ...previous, fields: { ...previous.fields, [alias]: '' }, form: undefined }));
  };

  const toggleScannerSelection = (scannerId: string, checked: boolean) => {
    setScannerSelection(previous => (
      checked ? [...previous, scannerId] : previous.filter(idValue => idValue !== scannerId)
    ));
  };

  const openScannerDialog = () => {
    setScannerSelection(assignedScanners.map(scanner => scanner.id));
    setScannerDialogOpen(true);
  };

  const handleSaveScannerAssignments = async () => {
    const selectedScannerIds = new Set(scannerSelection);
    const changedScanners = organizationScanners.filter(scanner => {
      const wasAssigned = scanner.assigned_events.includes(event.id);
      const shouldBeAssigned = selectedScannerIds.has(scanner.id);
      return wasAssigned !== shouldBeAssigned;
    });

    if (changedScanners.length === 0) {
      setScannerDialogOpen(false);
      return;
    }

    setScannerSaving(true);
    try {
      for (const scanner of changedScanners) {
        const shouldBeAssigned = selectedScannerIds.has(scanner.id);
        const nextAssignedEvents = shouldBeAssigned
          ? [...new Set([...scanner.assigned_events, event.id])]
          : scanner.assigned_events.filter(assignedEventId => assignedEventId !== event.id);

        const result = await assignScannerEvents(scanner.id, nextAssignedEvents);
        if (!result.ok) {
          toast({
            title: 'Nie udało się zapisać przypisań operatorów',
            description: result.error ?? `Nie udało się zaktualizować operatora ${scanner.name}.`,
            variant: 'destructive',
          });
          return;
        }
      }

      setScannerDialogOpen(false);
      toast({ title: 'Zapisano przypisania operatorów' });
    } finally {
      setScannerSaving(false);
    }
  };

  const handleManualSubmit = async () => {
    const fieldErrors = activeMappings.reduce<Record<string, string>>((accumulator, mapping) => {
      const error = validateRequired(manualFields[mapping.alias] ?? '', `Uzupełnij pole: ${mapping.alias}.`);
      if (error) accumulator[mapping.alias] = error;
      return accumulator;
    }, {});
    const nextErrors = {
      email: validateEmail(manualEmail),
      fields: fieldErrors,
    };

    if (nextErrors.email || Object.values(fieldErrors).some(Boolean)) {
      setManualErrors(nextErrors);
      return;
    }

    setManualErrors({ fields: {} });
    setManualSaving(true);
    const result = await addParticipantManually(event.id, manualEmail, manualFields);
    setManualSaving(false);

    if (!result.ok) {
      setManualErrors({ fields: {}, form: result.error ?? 'Nie udało się dodać uczestnika.' });
      toast({
        title: 'Nie udało się dodać uczestnika',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setManualOpen(false);
    setManualEmail('');
    setManualFields(buildEmptyParticipantFieldValues(mappings));
    setManualErrors({ fields: {} });
    toast({ title: 'Dodano uczestnika ręcznie' });
  };

  const handleEditSubmit = async () => {
    const submittedOfficeOpenAt = isFinishedEvent ? event.office_open_at : editForm.office_open_at;
    const submittedOfficeCloseAt = isFinishedEvent ? event.office_close_at : editForm.office_close_at;
    const nextErrors = {
      name: validateRequired(editForm.name, 'Podaj nazwę wydarzenia.'),
      location: validateRequired(editForm.location, 'Podaj lokalizację wydarzenia.'),
      office_open_at: validateRequired(submittedOfficeOpenAt, 'Podaj datę i godzinę otwarcia biura.'),
      office_close_at: validateRequired(submittedOfficeCloseAt, 'Podaj datę i godzinę zamknięcia biura.'),
    };

    if (nextErrors.name || nextErrors.location || nextErrors.office_open_at || nextErrors.office_close_at) {
      setEditErrors(nextErrors);
      return;
    }

    if (!submittedOfficeOpenAt || !submittedOfficeCloseAt || !isValidEventOfficeRange(submittedOfficeOpenAt, submittedOfficeCloseAt)) {
      setEditErrors({ office_close_at: 'Zamknięcie biura musi być później niż otwarcie.' });
      toast({
        title: 'Nieprawidłowe godziny biura',
        description: 'Podaj poprawną datę i godzinę otwarcia oraz zamknięcia biura zawodów.',
        variant: 'destructive',
      });
      return;
    }

    setEditErrors({});
    setEditSaving(true);
    const result = await updateEvent(event.id, {
      name: editForm.name,
      location: editForm.location,
      organization_id: event.organization_id,
      office_open_at: submittedOfficeOpenAt,
      office_close_at: submittedOfficeCloseAt,
    });
    setEditSaving(false);

    if (!result.ok) {
      setEditErrors({ form: result.error ?? 'Nie udało się zaktualizować wydarzenia.' });
      toast({
        title: 'Nie udało się zaktualizować wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setEditOpen(false);
    setEditErrors({});
    toast({ title: 'Zaktualizowano wydarzenie' });
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    const result = await exportEventCsv(event.id);
    setExportingCsv(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się wyeksportować CSV',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Eksport CSV rozpoczęty' });
  };

  const handleExportLogsCsv = async () => {
    setExportingLogsCsv(true);
    const result = await exportEventLogsCsv(event.id);
    setExportingLogsCsv(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się wyeksportować logów CSV',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Eksport logów CSV rozpoczęty' });
  };

  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    const result = await deleteEvent(event.id);
    setIsDeletingEvent(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się zarchiwizować wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteConfirmOpen(false);
    toast({ title: 'Wydarzenie zarchiwizowane' });
    navigate('/events');
  };

  return (
    <div className="event-detail-page space-y-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(isArchivedEvent ? `/organizations/${event.organization_id}/archived-events` : '/events')}
        className="event-detail-back touch-manipulation"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> {isArchivedEvent ? 'Wróć do archiwum' : 'Wróć do wydarzeń'}
      </Button>

      {isArchivedEvent && (
        <div className="archive-notice rounded-xl border px-4 py-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="archive-notice-icon mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
              <Archive className="h-4 w-4" />
            </div>
            <div>
              <p className="archive-notice-title font-semibold">To wydarzenie jest zarchiwizowane.</p>
              <p className="archive-notice-copy mt-1">
                Jest ukryte z aktywnych list i przypisań. Dane są dostępne do podglądu, a zmiany w archiwum może wykonywać tylko superadmin.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isOnline && canOperateOnEvent && (
        <OnlineOnlyNotice description="Import CSV, edycja wydarzenia, eksporty, wysyłka QR, ręczne dodawanie uczestników i zarządzanie operatorami wymagają aktywnego połączenia z serwerem." />
      )}

      <section className="event-detail-header-grid">
        <div className="event-detail-info-panel">
          <div className={cn('event-detail-status-row', officeToneClasses.status)}>
            <div className="event-detail-status-dot" />
            <div className="min-w-0">
              <p className="event-detail-status-kicker">Status wydarzenia</p>
              <p className="event-detail-status-value">{officeStatus.badgeLabel}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="event-detail-title">{event.name}</h1>
            <div className="event-detail-meta flex flex-col gap-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatEventOfficeWindow(event)}
              </span>
            </div>
            <p className="event-detail-headline">{officeStatus.headline}</p>
            <p className="event-detail-supporting-copy">{officeStatus.detail}</p>
          </div>

          <div className="event-detail-summary-strip">
            <div className="event-detail-stats-grid">
              <div className="event-detail-stat-item">
                <span className="event-detail-stat-label">Odprawieni</span>
                <strong className="event-detail-stat-value">{checkedIn}/{eventParticipants.length}</strong>
              </div>
              <div className="event-detail-stat-item">
                <span className="event-detail-stat-label">Uczestnicy</span>
                <strong className="event-detail-stat-value">{eventParticipants.length}</strong>
              </div>
              <div className="event-detail-stat-item">
                <span className="event-detail-stat-label">{officeStatus.timingLabel}</span>
                <strong className="event-detail-stat-value">{officeStatus.timingValue}</strong>
              </div>
            </div>
          </div>
        </div>

        {(canUseActiveEventTools || canEditEvent || canArchiveEvent) && (
          <aside className="event-detail-actions-panel">
            {canUseActiveEventTools && (
              <Button onClick={() => { setSelectedEventId(event.id); navigate('/scanner'); }} className="event-detail-primary-action h-12 w-full">
                <ScanLine className="mr-1 h-4 w-4" /> Otwórz skaner
              </Button>
            )}
            {canUseActiveEventTools && (
              <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/participants'); }} className="event-detail-secondary-action h-12 w-full">
                <Users className="mr-1 h-4 w-4" /> Uczestnicy
              </Button>
            )}
            {canEditEvent && (
              <Button variant="link" onClick={() => setEditOpen(true)} className="event-detail-tertiary-action px-0" disabled={!isOnline}>
                <Pencil className="h-4 w-4" /> Edytuj wydarzenie
              </Button>
            )}
            {canArchiveEvent && (
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(true)} className="event-detail-archive-action w-full" disabled={!isOnline}>
                <Archive className="mr-1 h-4 w-4" /> Archiwizuj wydarzenie
              </Button>
            )}
          </aside>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="event-detail-section-title text-xl font-bold tracking-tight">
            Zespół
          </h2>
        </div>

        {!hasAnyTeamMembers && (
          <div className="event-detail-empty-panel py-10 text-center">
            <p className="text-base font-semibold">
              {isFinishedEvent ? 'Nie było przypisanego zespołu' : 'Nie ma jeszcze przypisanego zespołu'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isFinishedEvent
                ? 'Sprawdź, czy organizacja miała przypisanych organizatorów, administratorów lub operatorów.'
                : 'Dodaj operatorów lub sprawdź, czy organizacja ma przypisanych organizatorów i administratorów.'}
            </p>
          </div>
        )}

        <div className="event-detail-section-group">
          <TeamRoleCard
            title="Administracja"
            users={organizationAdmins}
            emptyText="Brak administratorów."
            defaultOpen={false}
          />
          <TeamRoleCard
            title="Organizatorzy"
            users={organizationEditors}
            emptyText="Brak organizatorów."
            defaultOpen={false}
          />
          <TeamRoleCard
            title={isFinishedEvent ? 'Operatorzy pracujący przy wydarzeniu' : 'Operatorzy wydarzenia'}
            users={assignedScanners}
            emptyText="Brak operatorów."
            defaultOpen={false}
            action={canManageScanners && canAssignScannersToEvent ? (
              <Button variant="outline" size="sm" onClick={openScannerDialog} className="event-detail-secondary-action" disabled={!isOnline}>
                Zarządzaj
              </Button>
            ) : undefined}
          />
        </div>
      </section>

      {canOperateOnEvent && (
        <section className="space-y-4">
          <div>
            <h2 className="event-detail-section-title text-xl font-bold tracking-tight">
              Operacje
            </h2>
          </div>

          <div className="event-detail-section-group">
            <CollapsibleSection title="Operacje" defaultOpen={false}>
              <div className="flex flex-col gap-2">
                {canOperateOnEvent && (
                  <Button variant="outline" onClick={() => void handleExportCsv()} className="event-detail-operation-button h-11 justify-start" disabled={exportingCsv || !isOnline}>
                    {exportingCsv ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                    Eksport uczestników CSV
                  </Button>
                )}
                {canOperateOnEvent && (
                  <Button variant="outline" onClick={() => void handleExportLogsCsv()} className="event-detail-operation-button h-11 justify-start" disabled={exportingLogsCsv || !isOnline}>
                    {exportingLogsCsv ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                    Eksport logów CSV
                  </Button>
                )}
                {canEditEvent && (
                  <Button variant="outline" onClick={() => setEditOpen(true)} className="event-detail-operation-button h-11 justify-start" disabled={!isOnline}>
                    <Pencil className="mr-1 h-4 w-4" /> Edytuj wydarzenie
                  </Button>
                )}
                {canManageScanners && canAssignScannersToEvent && (
                  <Button variant="outline" onClick={openScannerDialog} className="event-detail-operation-button h-11 justify-start" disabled={!isOnline}>
                    <ScanLine className="mr-1 h-4 w-4" /> Zarządzaj operatorami
                  </Button>
                )}
                {!isArchivedEvent && canOperateOnEvent && (
                  <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate(`/events/${event.id}/import`); }} className="event-detail-operation-button h-11 justify-start" disabled={!isOnline}>
                    <FileUp className="mr-1 h-4 w-4" /> Import CSV
                  </Button>
                )}
                {!isArchivedEvent && canOperateOnEvent && (
                  <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/emails'); }} className="event-detail-operation-button h-11 justify-start" disabled={!isOnline}>
                    <Mail className="mr-1 h-4 w-4" /> Wysyłka QR
                  </Button>
                )}
                {!isArchivedEvent && canOperateOnEvent && hasSavedMapping && (
                  <Button variant="outline" onClick={() => setManualOpen(true)} className="event-detail-operation-button h-11 justify-start" disabled={!isOnline}>
                    <Plus className="mr-1 h-4 w-4" /> Dodaj uczestnika ręcznie
                  </Button>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </section>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Zarchiwizować wydarzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Wydarzenie <span className="font-medium text-foreground">{event.name}</span> zniknie z aktywnych list i przypisań. Dane zostaną zachowane w archiwum organizacji.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteEvent()} disabled={isDeletingEvent || !isOnline} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingEvent && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Archiwizuj wydarzenie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editOpen}
        onOpenChange={nextOpen => {
          setEditOpen(nextOpen);
          if (!nextOpen) setEditErrors({});
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj wydarzenie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="event-edit-name">Nazwa</Label>
              <Input
                id="event-edit-name"
                value={editForm.name}
                onChange={eventValue => {
                  setEditForm(current => ({ ...current, name: eventValue.target.value }));
                  setEditErrors(current => ({ ...current, name: undefined, form: undefined }));
                }}
                required
                aria-invalid={Boolean(editErrors.name)}
                aria-describedby={editErrors.name ? 'event-edit-name-error' : undefined}
              />
              <FieldError id="event-edit-name-error" className="mt-2">{editErrors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="event-edit-location">Lokalizacja</Label>
              <Input
                id="event-edit-location"
                value={editForm.location}
                onChange={eventValue => {
                  setEditForm(current => ({ ...current, location: eventValue.target.value }));
                  setEditErrors(current => ({ ...current, location: undefined, form: undefined }));
                }}
                required
                aria-invalid={Boolean(editErrors.location)}
                aria-describedby={editErrors.location ? 'event-edit-location-error' : undefined}
              />
              <FieldError id="event-edit-location-error" className="mt-2">{editErrors.location}</FieldError>
            </div>
            <div>
              <Label htmlFor="event-edit-office-open">Data i godzina otwarcia biura zawodów</Label>
              <DateTimePicker
                id="event-edit-office-open"
                value={editForm.office_open_at}
                disabled={isFinishedEvent}
                onChange={value => {
                  setEditForm(current => ({ ...current, office_open_at: value }));
                  setEditErrors(current => ({ ...current, office_open_at: undefined, office_close_at: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(editErrors.office_open_at)}
                aria-describedby={editErrors.office_open_at ? 'event-edit-office-open-error' : undefined}
              />
              {isFinishedEvent && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Dat zakończonego wydarzenia nie można już edytować.
                </p>
              )}
              <FieldError id="event-edit-office-open-error" className="mt-2">{editErrors.office_open_at}</FieldError>
            </div>
            <div>
              <Label htmlFor="event-edit-office-close">Data i godzina zamknięcia biura zawodów</Label>
              <DateTimePicker
                id="event-edit-office-close"
                value={editForm.office_close_at}
                disabled={isFinishedEvent}
                onChange={value => {
                  setEditForm(current => ({ ...current, office_close_at: value }));
                  setEditErrors(current => ({ ...current, office_close_at: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(editErrors.office_close_at)}
                aria-describedby={editErrors.office_close_at ? 'event-edit-office-close-error' : undefined}
              />
              <FieldError id="event-edit-office-close-error" className="mt-2">{editErrors.office_close_at}</FieldError>
            </div>
            <FieldError id="event-edit-form-error">{editErrors.form}</FieldError>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleEditSubmit} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manualOpen}
        onOpenChange={nextOpen => {
          setManualOpen(nextOpen);
          if (!nextOpen) setManualErrors({ fields: {} });
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
            <DialogTitle>Dodaj uczestnika ręcznie</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar grid flex-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="event-manual-participant-email">Email</Label>
              <Input
                id="event-manual-participant-email"
                type="email"
                value={manualEmail}
                onChange={eventValue => {
                  setManualEmail(eventValue.target.value);
                  setManualErrors(previous => ({ ...previous, email: undefined, form: undefined }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(manualErrors.email)}
                aria-describedby={manualErrors.email ? 'event-manual-participant-email-error' : undefined}
              />
              <FieldError id="event-manual-participant-email-error" className="mt-2">{manualErrors.email}</FieldError>
            </div>
            {activeMappings.map((mapping, index) => {
              const fieldId = `event-manual-participant-field-${index}`;
              const errorId = `${fieldId}-error`;
              const fieldError = manualErrors.fields[mapping.alias];

              return (
                <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                  <Label htmlFor={fieldId}>{mapping.alias}</Label>
                  <Input
                    id={fieldId}
                    value={manualFields[mapping.alias] ?? ''}
                    onChange={eventValue => handleManualFieldChange(mapping.alias, eventValue.target.value)}
                    className="mt-2"
                    required
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? errorId : undefined}
                  />
                  <FieldError id={errorId} className="mt-2">{fieldError}</FieldError>
                </div>
              );
            })}
            <FieldError id="event-manual-participant-form-error" className="lg:col-span-2">{manualErrors.form}</FieldError>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button className="w-full sm:w-auto" onClick={handleManualSubmit} disabled={manualSaving}>
              {manualSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {!manualSaving && <Plus className="mr-1 h-4 w-4" />}
              Zapisz uczestnika
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scannerDialogOpen} onOpenChange={setScannerDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Przypisz operatorów do wydarzenia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {organizationScanners.length > 0 ? (
              <div className="space-y-2 rounded-xl border p-3">
                {organizationScanners.map(scanner => (
                  <label key={scanner.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={scannerSelection.includes(scanner.id)} onCheckedChange={checked => toggleScannerSelection(scanner.id, checked === true)} />
                    <span className="min-w-0 truncate">{scanner.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Brak operatorów w organizacji tego wydarzenia.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleSaveScannerAssignments} disabled={scannerSaving || organizationScanners.length === 0}>
              {scannerSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz przypisania
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

