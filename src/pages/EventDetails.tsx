import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Badge } from '@/components/ui/badge';
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
import { Archive, ArrowLeft, Calendar, CheckCircle, Clock3, Download, FileUp, Loader2, MapPin, Pencil, Plus, ScanLine, Shield, UserPlus, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import { ParticipantFieldMapping, User } from '@/types';
import { formatEventOfficeEnd, formatEventOfficeStart, formatEventOfficeWindow, getEventOfficeCloseAt, getEventOfficeOpenAt, isEventOfficeOpen, isValidEventOfficeRange } from '@/lib/events';
import { buildEmptyParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';
import { validateEmail, validateRequired } from '@/lib/form-validation';
import { getScannerPermissionLabel, isScannerRole } from '@/lib/roles';

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
      detail: `Zespół zacznie pracę ${formatEventOfficeStart(eventOffice)}. Do tego czasu skanerzy nie zobaczą aktywnego wydarzenia.`,
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
      badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
      hero: 'border-emerald-500/20 bg-[linear-gradient(135deg,hsl(142_76%_36%/0.08),transparent_55%)]',
      iconWrap: 'bg-emerald-500/12 text-emerald-700',
      meter: 'bg-emerald-500',
    };
  }

  if (tone === 'upcoming') {
    return {
      badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
      hero: 'border-amber-500/20 bg-[linear-gradient(135deg,hsl(38_92%_50%/0.10),transparent_55%)]',
      iconWrap: 'bg-amber-500/12 text-amber-700',
      meter: 'bg-amber-500',
    };
  }

  return {
    badge: 'border-border bg-muted text-foreground',
    hero: 'border-border bg-[linear-gradient(135deg,hsl(var(--muted)/0.65),transparent_55%)]',
    iconWrap: 'bg-muted text-foreground',
    meter: 'bg-foreground/70',
  };
}

function getRoleCapabilities(role: 'admin' | 'editor' | 'scanner', isFinishedEvent: boolean) {
  if (role === 'admin') {
    if (isFinishedEvent) {
      return 'Ustawienia wydarzenia, godziny biura, eksport danych i przypisania skanerów.';
    }

    return 'Ustawienia wydarzenia, godziny biura, eksport danych i przypisywanie skanerów.';
  }

  if (role === 'editor') {
    if (isFinishedEvent) {
      return 'Obsługa uczestników, import CSV, wysyłka QR i praca operacyjna wykonana przy wydarzeniu.';
    }

    return 'Obsługa uczestników, import CSV, wysyłka QR i praca operacyjna na wydarzeniu.';
  }

  if (isFinishedEvent) {
    return 'Skanowanie QR i odprawa uczestników podczas pracy biura zawodów.';
  }

  return 'Skanowanie QR i odprawa uczestników podczas pracy biura zawodów.';
}

function TeamMemberRow({ user, badgeLabel }: { user: User; badgeLabel: string | ((user: User) => string) }) {
  const resolvedBadgeLabel = typeof badgeLabel === 'function' ? badgeLabel(user) : badgeLabel;

  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.role === 'scanner_plus' ? 'default' : 'secondary'} className="shrink-0">{resolvedBadgeLabel}</Badge>
      </div>
    </div>
  );
}

function TeamRoleCard({
  title,
  description,
  users,
  emptyText,
  badgeLabel,
  action,
}: {
  title: string;
  description: string;
  users: User[];
  emptyText: string;
  badgeLabel: string | ((user: User) => string);
  action?: ReactNode;
}) {
  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          users.map(user => <TeamMemberRow key={user.id} user={user} badgeLabel={badgeLabel} />)
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  iconClassName: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
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
    organizations,
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
  } = useData();
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
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
  const checkInProgress = eventParticipants.length > 0 ? Math.round((checkedIn / eventParticipants.length) * 100) : 0;
  const activeMappings = useMemo(() => getActiveParticipantMappings(mappings), [mappings]);
  const organizationName = organizations.find(organization => organization.id === event?.organization_id)?.name ?? 'Nieznana organizacja';
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
  const canViewParticipantMappings = currentRole === 'superadmin';

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
    if (!id) return;

    setMappingsLoading(true);
    getParticipantFieldMappings(id)
      .then(data => {
        setMappings(data);
        setManualFields(buildEmptyParticipantFieldValues(data));
      })
      .catch(() => {
        setMappings([]);
        setManualFields({});
      })
      .finally(() => setMappingsLoading(false));
  }, [getParticipantFieldMappings, id]);

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
            title: 'Nie udało się zapisać przypisań skanerów',
            description: result.error ?? `Nie udało się zaktualizować skanera ${scanner.name}.`,
            variant: 'destructive',
          });
          return;
        }
      }

      setScannerDialogOpen(false);
      toast({ title: 'Zapisano przypisania skanerów' });
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
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(isArchivedEvent ? `/organizations/${event.organization_id}/archived-events` : '/events')} className="touch-manipulation">
        <ArrowLeft className="mr-1 h-4 w-4" /> {isArchivedEvent ? 'Wróć do archiwum' : 'Wróć do wydarzeń'}
      </Button>

      {isArchivedEvent && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <Archive className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">To wydarzenie jest zarchiwizowane.</p>
              <p className="mt-1 text-amber-900/80">
                Jest ukryte z aktywnych list i przypisań. Dane są dostępne do podglądu, a zmiany w archiwum może wykonywać tylko superadmin.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className={`overflow-hidden shadow-sm ${officeToneClasses.hero}`}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={officeToneClasses.badge}>{officeStatus.badgeLabel}</Badge>
                  <Badge variant="outline">{organizationName}</Badge>
                </div>
                <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{event.name}</h1>
                <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </span>
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatEventOfficeWindow(event)}
                  </span>
                </div>
              </div>

              {canEditEvent && (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button variant="outline" onClick={() => setEditOpen(true)} className="w-full sm:w-auto">
                    <Pencil className="mr-1 h-4 w-4" /> Edytuj
                  </Button>
                  {canArchiveEvent && (
                    <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} className="w-full sm:w-auto">
                      <Archive className="mr-1 h-4 w-4" /> Archiwizuj
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-[1.6rem] border border-border/70 bg-background/80 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-lg font-semibold tracking-tight">{officeStatus.headline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{officeStatus.detail}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-left lg:min-w-[220px]">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{officeStatus.timingLabel}</p>
                  <p className="mt-2 text-sm font-semibold">{officeStatus.timingValue}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <StatTile
                icon={Clock3}
                label="Status biura"
                value={officeStatus.badgeLabel}
                hint={officeStatus.timingValue}
                iconClassName={officeToneClasses.iconWrap}
              />
              <StatTile
                icon={CheckCircle}
                label="Odprawieni"
                value={`${checkedIn}/${eventParticipants.length}`}
                hint={eventParticipants.length > 0 ? `${checkInProgress}% całej listy` : 'Brak uczestników na liście'}
                iconClassName="bg-primary/12 text-primary"
              />
              <StatTile
                icon={ScanLine}
                label="Skanerzy"
                value={String(assignedScanners.length)}
                hint={organizationScanners.length > 0 ? `${organizationScanners.length} dostępnych w organizacji` : 'Brak skanerów w organizacji'}
                iconClassName="bg-sky-500/12 text-sky-700"
              />
            </div>

            <div className="rounded-[1.6rem] border border-border/70 bg-background/85 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Postęp odprawy</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {eventParticipants.length > 0 && isFinishedEvent
                      ? `Odprawiono ${checkedIn} z ${eventParticipants.length} osób.`
                      : eventParticipants.length > 0
                        ? `${checkedIn} z ${eventParticipants.length} osób jest już odprawionych.`
                        : isFinishedEvent
                          ? 'Nie dodano uczestników do tego wydarzenia.'
                          : 'Po dodaniu uczestników tutaj od razu zobaczysz postęp odprawy.'}
                  </p>
                </div>
                <div className="text-3xl font-black tracking-tight">{checkInProgress}%</div>
              </div>
              <div className="mt-4 h-3 rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all ${officeToneClasses.meter}`} style={{ width: `${checkInProgress}%` }} />
              </div>
            </div>

            {canUseActiveEventTools && (
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
              <Button onClick={() => { setSelectedEventId(event.id); navigate('/scanner'); }} className="h-11 md:w-auto">
                <ScanLine className="mr-1 h-4 w-4" /> Otwórz skaner
              </Button>
              <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/participants'); }} className="h-11 md:w-auto">
                <Users className="mr-1 h-4 w-4" /> Uczestnicy
              </Button>
              <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate(`/events/${event.id}/import`); }} className="h-11 md:w-auto">
                <FileUp className="mr-1 h-4 w-4" /> Import CSV
              </Button>
              {hasSavedMapping && (
                <Button variant="outline" onClick={() => setManualOpen(true)} className="h-11 md:w-auto">
                  <UserPlus className="mr-1 h-4 w-4" /> Dodaj ręcznie
                </Button>
              )}
            </div>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {isFinishedEvent ? 'Kto pracował przy tym wydarzeniu' : 'Kto pracuje przy wydarzeniu'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFinishedEvent
              ? 'Podgląd zespołu i zakresu odpowiedzialności podczas tego wydarzenia.'
              : 'Prosty podgląd zespołu i zakresu odpowiedzialności dla tego wydarzenia.'}
          </p>
        </div>

        {!hasAnyTeamMembers && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <p className="text-base font-semibold">
                {isFinishedEvent ? 'Nie było przypisanego zespołu' : 'Nie ma jeszcze przypisanego zespołu'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {isFinishedEvent
                  ? 'Sprawdź, czy organizacja miała przypisanych organizatorów, administratorów lub skanerów.'
                  : 'Dodaj skanerów lub sprawdź, czy organizacja ma przypisanych organizatorów i administratorów.'}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <TeamRoleCard
            title="Administracja"
            description={getRoleCapabilities('admin', isFinishedEvent)}
            users={organizationAdmins}
            emptyText="Brak administratorów przypisanych do tej organizacji."
            badgeLabel="Admin"
          />
          <TeamRoleCard
            title="Organizatorzy"
            description={getRoleCapabilities('editor', isFinishedEvent)}
            users={organizationEditors}
            emptyText="Brak organizatorów przypisanych do tej organizacji."
            badgeLabel="Organizator"
          />
          <TeamRoleCard
            title={isFinishedEvent ? 'Skanerzy pracujący przy wydarzeniu' : 'Skanerzy wydarzenia'}
            description={getRoleCapabilities('scanner', isFinishedEvent)}
            users={assignedScanners}
            emptyText={isFinishedEvent ? 'Do tego wydarzenia nie przypisano żadnego skanera.' : 'Do tego wydarzenia nie przypisano jeszcze żadnego skanera.'}
            badgeLabel={(user) => getScannerPermissionLabel(user.role)}
            action={canManageScanners && canUseActiveEventTools ? (
              <Button variant="outline" size="sm" onClick={openScannerDialog}>
                Zarządzaj
              </Button>
            ) : undefined}
          />
        </div>
      </section>

      {(canOperateOnEvent || canViewParticipantMappings) && (
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base">Dane i eksporty</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isFinishedEvent
                ? 'Dane administracyjne i eksporty po zakończeniu wydarzenia.'
                : 'Miejsce na operacje administracyjne i szybkie pobranie danych wydarzenia.'}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            {canOperateOnEvent && (
            <Button variant="outline" onClick={() => void handleExportCsv()} className="h-11 justify-start" disabled={exportingCsv}>
              {exportingCsv ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Eksport uczestników CSV
            </Button>
            )}
            {canOperateOnEvent && (
            <Button variant="outline" onClick={() => void handleExportLogsCsv()} className="h-11 justify-start" disabled={exportingLogsCsv}>
              {exportingLogsCsv ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Eksport logów CSV
            </Button>
            )}
            {canEditEvent && (
              <Button variant="outline" onClick={() => setEditOpen(true)} className="h-11 justify-start">
                <Pencil className="mr-1 h-4 w-4" /> Edytuj dane wydarzenia
              </Button>
            )}
            {canManageScanners && canUseActiveEventTools && (
              <Button variant="outline" onClick={openScannerDialog} className="h-11 justify-start">
                <ScanLine className="mr-1 h-4 w-4" /> Zarządzaj skanerami
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base">{isFinishedEvent ? 'Uczestnicy i mapowanie' : 'Konfiguracja uczestników'}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isFinishedEvent
                ? 'Zapisane mapowanie CSV i dane używane przy obsłudze uczestników.'
                : 'Stan mapowania CSV i możliwość ręcznego dodania uczestnika.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {mappingsLoading ? (
              <p className="text-sm text-muted-foreground">Ładowanie mapowania...</p>
            ) : hasSavedMapping ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {mappings.map(mapping => (
                    <Badge key={`${mapping.source_column_name}-${mapping.alias}`} variant="outline">
                      {mapping.alias} ({mapping.field_role})
                    </Badge>
                  ))}
                </div>
                {canOperateOnEvent && (
                <Button variant="outline" onClick={() => setManualOpen(true)} className="h-11 w-full justify-start">
                  <Plus className="mr-1 h-4 w-4" /> Dodaj uczestnika ręcznie
                </Button>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                To wydarzenie nie ma jeszcze zapisanego mapowania CSV. Po pierwszym imporcie pojawi się też ręczne dodawanie uczestników.
              </div>
            )}

            {canViewParticipantMappings && (
              <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Widok mapowania pól jest dostępny tutaj, ponieważ pracujesz jako superadmin.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
            <AlertDialogAction onClick={() => void handleDeleteEvent()} disabled={isDeletingEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            <DialogTitle>Przypisz skanerów do wydarzenia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {organizationScanners.length > 0 ? (
              <div className="space-y-2 rounded-xl border p-3">
                {organizationScanners.map(scanner => (
                  <label key={scanner.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={scannerSelection.includes(scanner.id)} onCheckedChange={checked => toggleScannerSelection(scanner.id, checked === true)} />
                    <span className="min-w-0">
                      <span className="block truncate">{scanner.name}</span>
                      <span className="block text-xs text-muted-foreground">{getScannerPermissionLabel(scanner.role)}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Brak skanerów w organizacji tego wydarzenia.
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
