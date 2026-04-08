import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Calendar, CheckCircle, Clock3, Download, FileUp, Loader2, MapPin, Pencil, Plus, ScanLine, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import { ParticipantFieldMapping, User } from '@/types';
import { formatEventOfficeEnd, formatEventOfficeStart, formatEventOfficeWindow, getEventOfficeCloseAt, getEventOfficeOpenAt, isEventOfficeOpen, isValidEventOfficeRange } from '@/lib/events';
import { buildEmptyParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { participantCountsAsCheckedIn } from '@/lib/participant-status';

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

function getRoleCapabilities(role: 'admin' | 'editor' | 'scanner') {
  if (role === 'admin') {
    return 'Ustawienia wydarzenia, godziny biura, eksport danych i przypisywanie skanerów.';
  }

  if (role === 'editor') {
    return 'Obsługa uczestników, import CSV, wysyłka QR i praca operacyjna na wydarzeniu.';
  }

  return 'Skanowanie QR i odprawa uczestników podczas pracy biura zawodów.';
}

function TeamMemberRow({ user, badgeLabel }: { user: User; badgeLabel: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">{badgeLabel}</Badge>
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
  badgeLabel: string;
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
  const [manualSaving, setManualSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
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

  const event = events.find(entry => entry.id === id);
  const eventParticipants = participants.filter(participant => participant.event_id === id);
  const checkedIn = eventParticipants.filter(participantCountsAsCheckedIn).length;
  const checkInProgress = eventParticipants.length > 0 ? Math.round((checkedIn / eventParticipants.length) * 100) : 0;
  const activeMappings = useMemo(() => getActiveParticipantMappings(mappings), [mappings]);
  const organizationName = organizations.find(organization => organization.id === event?.organization_id)?.name ?? 'Nieznana organizacja';
  const organizationScanners = useMemo(
    () => users.filter(user => user.role === 'scanner' && user.organization_id === event?.organization_id),
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
  const canEditEvent = canManageScanners;
  const canViewParticipantMappings = currentRole === 'superadmin';

  useEffect(() => {
    if (id) {
      setSelectedEventId(id);
    }
  }, [id, setSelectedEventId]);

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

  const handleManualFieldChange = (alias: string, value: string) => {
    setManualFields(previous => ({ ...previous, [alias]: value }));
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
    setManualSaving(true);
    const result = await addParticipantManually(event.id, manualEmail, manualFields);
    setManualSaving(false);

    if (!result.ok) {
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
    toast({ title: 'Dodano uczestnika ręcznie' });
  };

  const handleEditSubmit = async () => {
    if (!editForm.name || !editForm.location) return;
    if (!editForm.office_open_at || !editForm.office_close_at || !isValidEventOfficeRange(editForm.office_open_at, editForm.office_close_at)) {
      toast({
        title: 'Nieprawidłowe godziny biura',
        description: 'Podaj poprawną datę i godzinę otwarcia oraz zamknięcia biura zawodów.',
        variant: 'destructive',
      });
      return;
    }

    setEditSaving(true);
    const result = await updateEvent(event.id, {
      name: editForm.name,
      location: editForm.location,
      organization_id: event.organization_id,
      office_open_at: editForm.office_open_at,
      office_close_at: editForm.office_close_at,
    });
    setEditSaving(false);

    if (!result.ok) {
      toast({
        title: 'Nie udało się zaktualizować wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setEditOpen(false);
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
        title: 'Nie udało się usunąć wydarzenia',
        description: result.error ?? 'Spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteConfirmOpen(false);
    toast({ title: 'Wydarzenie usunięte' });
    navigate('/events');
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/events')} className="touch-manipulation">
        <ArrowLeft className="mr-1 h-4 w-4" /> Wróć do wydarzeń
      </Button>

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
                  <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} className="w-full sm:w-auto">
                    <Trash2 className="mr-1 h-4 w-4" /> Usuń
                  </Button>
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
                    {eventParticipants.length > 0
                      ? `${checkedIn} z ${eventParticipants.length} osób jest już odprawionych.`
                      : 'Po dodaniu uczestników tutaj od razu zobaczysz postęp odprawy.'}
                  </p>
                </div>
                <div className="text-3xl font-black tracking-tight">{checkInProgress}%</div>
              </div>
              <div className="mt-4 h-3 rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all ${officeToneClasses.meter}`} style={{ width: `${checkInProgress}%` }} />
              </div>
            </div>

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
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Kto pracuje przy wydarzeniu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prosty podgląd zespołu i zakresu odpowiedzialności dla tego wydarzenia.
          </p>
        </div>

        {!hasAnyTeamMembers && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <p className="text-base font-semibold">Nie ma jeszcze przypisanego zespołu</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Dodaj skanerów lub sprawdź, czy organizacja ma przypisanych organizatorów i administratorów.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <TeamRoleCard
            title="Administracja"
            description={getRoleCapabilities('admin')}
            users={organizationAdmins}
            emptyText="Brak administratorów przypisanych do tej organizacji."
            badgeLabel="Admin"
          />
          <TeamRoleCard
            title="Organizatorzy"
            description={getRoleCapabilities('editor')}
            users={organizationEditors}
            emptyText="Brak organizatorów przypisanych do tej organizacji."
            badgeLabel="Organizator"
          />
          <TeamRoleCard
            title="Skanerzy wydarzenia"
            description={getRoleCapabilities('scanner')}
            users={assignedScanners}
            emptyText="Do tego wydarzenia nie przypisano jeszcze żadnego skanera."
            badgeLabel="Skaner"
            action={canManageScanners ? (
              <Button variant="outline" size="sm" onClick={openScannerDialog}>
                Zarządzaj
              </Button>
            ) : undefined}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base">Dane i eksporty</CardTitle>
            <p className="text-sm text-muted-foreground">
              Miejsce na operacje administracyjne i szybkie pobranie danych wydarzenia.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            <Button variant="outline" onClick={() => void handleExportCsv()} className="h-11 justify-start" disabled={exportingCsv}>
              {exportingCsv ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Eksport uczestników CSV
            </Button>
            <Button variant="outline" onClick={() => void handleExportLogsCsv()} className="h-11 justify-start" disabled={exportingLogsCsv}>
              {exportingLogsCsv ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Eksport logów CSV
            </Button>
            {canEditEvent && (
              <Button variant="outline" onClick={() => setEditOpen(true)} className="h-11 justify-start">
                <Pencil className="mr-1 h-4 w-4" /> Edytuj dane wydarzenia
              </Button>
            )}
            {canManageScanners && (
              <Button variant="outline" onClick={openScannerDialog} className="h-11 justify-start">
                <ScanLine className="mr-1 h-4 w-4" /> Zarządzaj skanerami
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base">Konfiguracja uczestników</CardTitle>
            <p className="text-sm text-muted-foreground">
              Stan mapowania CSV i możliwość ręcznego dodania uczestnika.
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
                <Button variant="outline" onClick={() => setManualOpen(true)} className="h-11 w-full justify-start">
                  <Plus className="mr-1 h-4 w-4" /> Dodaj uczestnika ręcznie
                </Button>
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wydarzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Wydarzenie <span className="font-medium text-foreground">{event.name}</span> zostanie usunięte razem z uczestnikami przypisanymi do tego wydarzenia. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteEvent()} disabled={isDeletingEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingEvent && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Usuń wydarzenie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj wydarzenie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nazwa</Label><Input value={editForm.name} onChange={eventValue => setEditForm(current => ({ ...current, name: eventValue.target.value }))} /></div>
            <div><Label>Lokalizacja</Label><Input value={editForm.location} onChange={eventValue => setEditForm(current => ({ ...current, location: eventValue.target.value }))} /></div>
            <div><Label>Data i godzina otwarcia biura zawodów</Label><Input type="datetime-local" value={editForm.office_open_at} onChange={eventValue => setEditForm(current => ({ ...current, office_open_at: eventValue.target.value }))} /></div>
            <div><Label>Data i godzina zamknięcia biura zawodów</Label><Input type="datetime-local" value={editForm.office_close_at} onChange={eventValue => setEditForm(current => ({ ...current, office_close_at: eventValue.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={handleEditSubmit} disabled={!editForm.name || !editForm.location || !editForm.office_open_at || !editForm.office_close_at || editSaving}>
              {editSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
            <DialogTitle>Dodaj uczestnika ręcznie</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <Label>Email</Label>
              <Input value={manualEmail} onChange={eventValue => setManualEmail(eventValue.target.value)} className="mt-2" />
            </div>
            {activeMappings.map(mapping => (
              <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                <Label>{mapping.alias}</Label>
                <Input
                  value={manualFields[mapping.alias] ?? ''}
                  onChange={eventValue => handleManualFieldChange(mapping.alias, eventValue.target.value)}
                  className="mt-2"
                />
              </div>
            ))}
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
                    <span>{scanner.name}</span>
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
