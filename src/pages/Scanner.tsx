import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2, Undo2, UserX2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { ParticipantBibNumberConflictDialog } from '@/components/ParticipantBibNumberConflictDialog';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import type { Participant, ParticipantFieldMapping } from '@/types';
import QrScannerView from '@/components/QrScannerView';
import ParticipantSearch from '@/components/ParticipantSearch';
import ScannerSkeleton from '@/components/skeletons/ScannerSkeleton';
import { buildParticipantFieldValues } from '@/lib/participant-fields';
import { formatBibNumber } from '@/lib/participants';
import { getParticipantStatusDefinition } from '@/lib/participant-status';
import { formatEventOfficeWindow, isEventOfficeOpen } from '@/lib/events';
import { buildEventParticipantPath } from '@/lib/routes';
import { canManageParticipantData, canUseParticipantAdminActions, isScannerRole } from '@/lib/roles';

type ScannerView = 'idle' | 'success' | 'error' | 'detail';
type ParticipantFieldEntry = {
  label: string;
  value: string;
  role: ParticipantFieldMapping['field_role'] | 'system';
};

function formatParticipantFieldLabel(label: string) {
  return label
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatScannerDateTime(value?: string) {
  if (!value) {
    return 'Jeszcze nie odprawiony';
  }

  const normalizedValue = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function isScannerBibNumberMissing(value?: string | null) {
  const normalizedValue = (value ?? '').trim();
  return normalizedValue === '' || normalizedValue === '0';
}

function normalizeScannerBibNumberInput(value?: string | null) {
  return isScannerBibNumberMissing(value) ? '' : (value ?? '').trim();
}

export default function Scanner() {
  const navigate = useNavigate();
  const {
    participants,
    selectedEventId,
    selectedOrganizationId,
    updateParticipantStatus,
    updateParticipantBibNumber,
    currentRole,
    scanParticipantQr,
    isLoading,
    visibleEvents,
    connectionState,
    pendingMutationCount,
    scannerMode,
    getParticipantFieldMappings,
  } = useData();
  const [view, setView] = useState<ScannerView>('idle');
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [showRecent, setShowRecent] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [participantMappings, setParticipantMappings] = useState<ParticipantFieldMapping[]>([]);
  const [errorMessage, setErrorMessage] = useState('Nie znaleziono uczestnika dla tego kodu QR.');
  const [manualBibNumberOpen, setManualBibNumberOpen] = useState(false);
  const [bibNumberValue, setBibNumberValue] = useState('');
  const [bibNumberError, setBibNumberError] = useState<string | undefined>();
  const [bibNumberConflictOpen, setBibNumberConflictOpen] = useState(false);
  const [bibNumberConflictParticipants, setBibNumberConflictParticipants] = useState<Participant[]>([]);
  const [pendingBibNumberCandidate, setPendingBibNumberCandidate] = useState('');
  const [isSavingBibNumber, setIsSavingBibNumber] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const scanRequestInFlightRef = useRef(false);
  const selectedEvent = visibleEvents.find(event => event.id === selectedEventId) ?? null;
  const scannerAvailable = selectedEvent !== null && isEventOfficeOpen(selectedEvent);
  const activeEventId = selectedEvent?.id ?? selectedEventId;
  const isReadOnly = scannerMode === 'read_only';
  const isOfflineQueue = scannerMode === 'offline_queue';
  const isOnline = connectionState === 'online';
  const hasParticipantDataManagementAccess = canManageParticipantData(currentRole);
  const canUseParticipantAdminConflictActions = canUseParticipantAdminActions(currentRole);

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === activeEventId),
    [activeEventId, participants],
  );
  const hasActiveEvents = visibleEvents.length > 0;

  useEffect(() => () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!activeEventId || connectionState !== 'online') {
      setParticipantMappings([]);
      return;
    }

    void getParticipantFieldMappings(activeEventId)
      .then(setParticipantMappings)
      .catch(() => setParticipantMappings([]));
  }, [activeEventId, connectionState, getParticipantFieldMappings]);

  useEffect(() => {
    if (!scannedParticipant) {
      return;
    }

    const refreshedParticipant = participants.find(participant => participant.id === scannedParticipant.id);
    if (!refreshedParticipant || refreshedParticipant === scannedParticipant) {
      return;
    }

    setScannedParticipant(refreshedParticipant);
    setRecentScans(previous =>
      previous.map(entry => (entry.id === refreshedParticipant.id ? refreshedParticipant : entry)),
    );
  }, [participants, scannedParticipant]);

  useEffect(() => {
    setBibNumberValue(normalizeScannerBibNumberInput(scannedParticipant?.bib_number));
    setBibNumberError(undefined);
    setBibNumberConflictOpen(false);
    setBibNumberConflictParticipants([]);
    setPendingBibNumberCandidate('');
  }, [scannedParticipant?.bib_number, scannedParticipant?.id]);

  const addToRecent = useCallback((participant: Participant) => {
    setRecentScans(previous => [participant, ...previous.filter(entry => entry.id !== participant.id)].slice(0, 5));
  }, []);

  const syncParticipantInView = useCallback((participant: Participant) => {
    setScannedParticipant(participant);
    setRecentScans(previous =>
      previous.map(entry => (entry.id === participant.id ? participant : entry)),
    );
  }, []);

  const showSuccessScreen = useCallback((participant: Participant) => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    setScannedParticipant(participant);
    addToRecent(participant);
    setView('success');
    toast({ title: 'Zarejestrowany', description: participant.name });
    successTimerRef.current = setTimeout(() => {
      setView('idle');
      setScannedParticipant(null);
    }, 1800);
  }, [addToRecent]);

  const handleQrScan = useCallback(async (decodedText: string) => {
    if (scanRequestInFlightRef.current) {
      return;
    }

    scanRequestInFlightRef.current = true;
    try {
      const result = await scanParticipantQr(decodedText);
      if (!result.ok || !result.data) {
        setErrorMessage(result.error ?? 'Nie znaleziono uczestnika dla tego kodu QR.');
        setView('error');
        successTimerRef.current = setTimeout(() => setView('idle'), 2500);
        return;
      }

      const participant = result.data.participant;
      setScannedParticipant(participant);
      addToRecent(participant);
      setView('detail');
    } finally {
      scanRequestInFlightRef.current = false;
    }
  }, [addToRecent, scanParticipantQr]);

  const handleSearchSelect = useCallback((participant: Participant) => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    setScannedParticipant(participant);
    addToRecent(participant);
    setView('detail');
  }, [addToRecent]);

  const resetToIdle = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    setView('idle');
    setScannedParticipant(null);
  }, []);

  const mutateStatus = useCallback(async (status: Participant['status'], successTitle: string) => {
    if (!scannedParticipant) {
      return;
    }

    if (isReadOnly) {
      toast({
        title: 'Skaner jest teraz tylko do odczytu',
        description: 'Połączenie było zbyt długo niedostępne albo kolejka zmian jest zbyt długa.',
        variant: 'destructive',
      });
      return;
    }

    setIsMutating(true);
    try {
      const result = await updateParticipantStatus(scannedParticipant.id, status, { allowOfflineQueue: true });
      if (!result.ok) {
        toast({ title: 'Nie udało się zaktualizować statusu', description: result.error, variant: 'destructive' });
        return;
      }

      const queuedLocally = result.queued === true;
      const updatedParticipant: Participant = {
        ...scannedParticipant,
        status,
        checked_in_at: status === 'not_checked_in' ? undefined : (scannedParticipant.checked_in_at ?? new Date().toISOString()),
      };

      if (status === 'not_checked_in') {
        syncParticipantInView(updatedParticipant);
      } else {
        showSuccessScreen(updatedParticipant);
      }

      toast({
        title: queuedLocally ? 'Zmiana zapisana lokalnie' : successTitle,
        description: queuedLocally
          ? `${scannedParticipant.name} czeka na synchronizacje po odzyskaniu polaczenia.`
          : scannedParticipant.name,
      });
    } finally {
      setIsMutating(false);
    }
  }, [isReadOnly, scannedParticipant, showSuccessScreen, syncParticipantInView, updateParticipantStatus]);

  const handleSaveBibNumber = useCallback(async () => {
    if (!scannedParticipant) {
      return;
    }

    const normalizedBibNumber = bibNumberValue.trim();
    if (normalizedBibNumber.length > 32) {
      setBibNumberError('Numer startowy może mieć maksymalnie 32 znaki.');
      return;
    }

    setBibNumberError(undefined);
    setIsSavingBibNumber(true);
    try {
      const result = await updateParticipantBibNumber(
        scannedParticipant.id,
        normalizedBibNumber,
      );

      if (result.conflict) {
        setPendingBibNumberCandidate(result.conflict.bibNumber);
        setBibNumberConflictParticipants(result.conflict.conflictingParticipants);
        setBibNumberConflictOpen(true);
        return;
      }

      if (!result.ok) {
        setBibNumberError(result.error);
        toast({
          title: 'Nie udało się zapisać numeru startowego',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      syncParticipantInView({ ...scannedParticipant, bib_number: normalizedBibNumber });
      toast({
        title: normalizedBibNumber ? 'Numer startowy zapisany' : 'Numer startowy wyczyszczony',
      });
    } finally {
      setIsSavingBibNumber(false);
    }
  }, [bibNumberValue, scannedParticipant, syncParticipantInView, updateParticipantBibNumber]);

  const handleResolveBibNumberConflict = useCallback(async (
    resolution: 'keep_duplicates' | 'delete_conflicts',
  ) => {
    if (!scannedParticipant) {
      return;
    }

    setIsSavingBibNumber(true);
    try {
      const result = await updateParticipantBibNumber(
        scannedParticipant.id,
        pendingBibNumberCandidate,
        { conflictResolution: resolution },
      );

      if (!result.ok) {
        setBibNumberError(result.error);
        toast({
          title: 'Nie udało się zapisać numeru startowego',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      syncParticipantInView({
        ...scannedParticipant,
        bib_number: pendingBibNumberCandidate,
      });
      setBibNumberValue(pendingBibNumberCandidate);
      setBibNumberConflictOpen(false);
      setBibNumberConflictParticipants([]);
      setPendingBibNumberCandidate('');
      toast({
        title:
          resolution === 'delete_conflicts'
            ? 'Numer przeniesiony i konflikty usunięte'
            : 'Numer startowy zapisany dla wielu uczestników',
      });
    } finally {
      setIsSavingBibNumber(false);
    }
  }, [pendingBibNumberCandidate, scannedParticipant, syncParticipantInView, updateParticipantBibNumber]);

  const handleBibNumberConflictOpenChange = useCallback((nextOpen: boolean) => {
    setBibNumberConflictOpen(nextOpen);
    if (!nextOpen) {
      setBibNumberValue(normalizeScannerBibNumberInput(scannedParticipant?.bib_number));
      setBibNumberError(undefined);
      setPendingBibNumberCandidate('');
      setBibNumberConflictParticipants([]);
    }
  }, [scannedParticipant?.bib_number]);

  const mappedParticipantFields = useMemo(() => {
    if (!scannedParticipant) {
      return {
        contact: [] as ParticipantFieldEntry[],
        identity: [] as ParticipantFieldEntry[],
        important: [] as ParticipantFieldEntry[],
        additional: [] as ParticipantFieldEntry[],
        usesFallback: false,
      };
    }

    const activeMappings = [...participantMappings]
      .filter(mapping => mapping.is_active)
      .sort((first, second) => first.display_order - second.display_order);

    const mappedValues = buildParticipantFieldValues(activeMappings, scannedParticipant);
    const entries = activeMappings.map<ParticipantFieldEntry>(mapping => {
      let value = '';

      if (mapping.field_role === 'email') {
        value = scannedParticipant.email;
      } else if (mapping.field_role === 'bib_number') {
        value = scannedParticipant.bib_number;
      } else {
        value = mappedValues[mapping.alias] ?? scannedParticipant.custom_fields?.[mapping.alias] ?? '';
      }

      return {
        label: mapping.alias,
        value: value.trim(),
        role: mapping.field_role,
      };
    });

    const importantAliases = new Set(scannedParticipant.important_field_aliases ?? []);
    const fallbackEntries = entries.length === 0
      ? Object.entries(scannedParticipant.custom_fields ?? {})
          .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey, 'pl', { sensitivity: 'base' }))
          .map<ParticipantFieldEntry>(([label, value]) => ({
            label,
            value: String(value ?? '').trim(),
            role: importantAliases.has(label) ? 'important_custom' : 'custom',
          }))
      : [];
    const usesFallback = entries.length === 0;

    return {
      contact: entries.filter(entry => entry.role === 'email'),
      identity: entries.filter(entry => entry.role === 'display_name_part'),
      important: usesFallback
        ? fallbackEntries.filter(entry => entry.role === 'important_custom')
        : entries.filter(entry => entry.role === 'important_custom'),
      additional: usesFallback
        ? fallbackEntries.filter(entry => entry.role === 'custom')
        : entries.filter(entry => entry.role === 'custom'),
      usesFallback,
    };
  }, [participantMappings, scannedParticipant]);

  const primaryParticipantFields = useMemo(() => {
    if (!scannedParticipant) {
      return [] as ParticipantFieldEntry[];
    }

    return [
      ...mappedParticipantFields.identity,
      ...mappedParticipantFields.important,
      ...(mappedParticipantFields.contact.length > 0
        ? mappedParticipantFields.contact
        : [{
            label: 'Email',
            value: scannedParticipant.email,
            role: 'system' as const,
          }]),
    ];
  }, [mappedParticipantFields.contact, mappedParticipantFields.identity, mappedParticipantFields.important, scannedParticipant]);

  const hasRemainingParticipantData = Boolean(scannedParticipant)
    && mappedParticipantFields.additional.length > 0;

  const normalizedCurrentBibNumber = normalizeScannerBibNumberInput(scannedParticipant?.bib_number);

  const renderFieldGrid = (title: string, description: string, fields: ParticipantFieldEntry[]) => {
    if (fields.length === 0) {
      return null;
    }

    return (
      <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
        <div className="mb-3">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map(field => (
            <div key={`${title}-${field.role}-${field.label}`} className="min-h-24 rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {formatParticipantFieldLabel(field.label)}
              </p>
              <p className={`mt-2 break-words text-base font-semibold leading-snug [overflow-wrap:anywhere] ${field.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                {field.value || 'Brak danych'}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <ScannerSkeleton />;
  }

  if (!hasActiveEvents && isScannerRole(currentRole)) {
    return <Navigate to="/scanner-info" replace />;
  }

  if (!selectedEvent) {
    return (
      <div className="mx-auto max-w-xl px-4 md:px-0">
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-base font-semibold">Brak wybranego wydarzenia</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {currentRole === 'admin' && selectedOrganizationId
                ? 'Do wybranej organizacji nie dodano jeszcze wydarzeń. Dodaj je w zakładce Wydarzenia.'
                : 'Wybierz wydarzenie z menu bocznego, aby uruchomić skaner.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!scannerAvailable) {
    return (
      <div className="mx-auto max-w-xl px-4 md:px-0">
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-base font-semibold">Skaner jest teraz niedostępny</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Skaner można uruchomić tylko w godzinach otwarcia biura zawodów dla wybranego wydarzenia.
            </p>
            <div className="mt-5 rounded-xl border bg-muted/30 px-4 py-3 text-left text-sm">
              <p className="font-medium text-foreground">{selectedEvent.name}</p>
              <p className="mt-1 text-muted-foreground">Biuro: {formatEventOfficeWindow(selectedEvent)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'success' && scannedParticipant) {
    const status = getParticipantStatusDefinition(scannedParticipant.status);

    return (
      <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-emerald-600 animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="w-full max-w-[min(28rem,100vw)] space-y-4 px-4 text-center text-white sm:px-6">
          <CheckCircle className="mx-auto h-16 w-16 sm:h-20 sm:w-20" strokeWidth={2.5} />
          <p className="mx-auto max-w-full break-words font-heading text-[clamp(1.5rem,9vw,3.75rem)] font-black leading-tight tracking-tight [overflow-wrap:anywhere]">{status.shortLabel.toUpperCase()}</p>
          <p className="break-words text-xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-2xl md:text-3xl">{scannedParticipant.name}</p>
          <p className={`break-words font-black leading-tight [overflow-wrap:anywhere] ${isScannerBibNumberMissing(scannedParticipant.bib_number) ? 'font-heading text-2xl sm:text-3xl md:text-4xl' : 'font-mono text-4xl tabular-nums sm:text-5xl md:text-7xl'}`}>
            {formatBibNumber(scannedParticipant.bib_number)}
          </p>
          {scannedParticipant.status === 'checked_in_not_starting' && (
            <p className="mt-4 text-base opacity-80">Pakiet odebrany, uczestnik nie wystartuje</p>
          )}
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-destructive animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="max-w-md space-y-4 px-6 text-center text-white">
          <AlertTriangle className="mx-auto h-16 w-16 sm:h-20 sm:w-20" strokeWidth={2.5} />
          <p className="text-3xl font-black sm:text-4xl md:text-5xl">BŁĄD SKANU</p>
          <p className="text-sm opacity-80 sm:text-base">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto space-y-4 ${view === 'detail' ? 'max-w-6xl' : 'max-w-xl'}`}>
      <div className="px-4 md:px-0">
        <PageHeader title="Skaner" />
        {(connectionState !== 'online' || pendingMutationCount > 0) && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${isReadOnly ? 'border-amber-500/40 bg-amber-500/10 text-amber-950' : 'border-sky-500/30 bg-sky-500/10 text-sky-950'}`}>
            <p className="font-semibold">
              {isReadOnly
                ? 'Tryb tylko do odczytu'
                : isOfflineQueue
                  ? 'Tryb offline z kolejką synchronizacji'
                  : 'Oczekiwanie na synchronizację'}
            </p>
            <p className="mt-1 text-current/80">
              {isReadOnly
                ? 'Dalsze zmiany statusów są zablokowane, żeby nie pracować na zbyt starych danych.'
                : connectionState === 'online'
                  ? `W kolejce czeka ${pendingMutationCount} ${pendingMutationCount === 1 ? 'zmiana' : 'zmian'} statusu.`
                  : 'Skaner rozpoznaje uczestników lokalnie i zapisuje zmiany do wysłania po odzyskaniu połączenia.'}
            </p>
          </div>
        )}
      </div>

      {view === 'idle' && (
        <>
          <div className="px-4 md:px-0">
            <ParticipantSearch participants={eventParticipants} onSelect={handleSearchSelect} autoFocus={false} />
          </div>

          <div className="px-4 md:px-0">
            <QrScannerView onScan={handleQrScan} paused={false} />
          </div>
        </>
      )}

      {view === 'detail' && scannedParticipant && (
        <div className="px-4 md:px-0">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4 border-b border-border/70 bg-background/25 p-4 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.34fr)] lg:items-center">
                <div className="min-w-0">
                  <CardTitle className="break-words text-2xl leading-tight [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">{scannedParticipant.name}</CardTitle>
                  <p className="mt-2 break-all text-base font-medium leading-snug text-muted-foreground [overflow-wrap:anywhere] sm:text-lg">{scannedParticipant.email}</p>
                </div>
                <span className={`min-w-0 max-w-full whitespace-normal break-words rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-left font-black leading-tight [overflow-wrap:anywhere] lg:text-right ${isScannerBibNumberMissing(scannedParticipant.bib_number) ? 'font-heading text-2xl text-muted-foreground sm:text-3xl' : 'font-mono text-4xl tabular-nums text-primary sm:text-5xl'}`}>
                  {isScannerBibNumberMissing(scannedParticipant.bib_number)
                    ? 'Do uzupełnienia'
                    : formatBibNumber(scannedParticipant.bib_number)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getParticipantStatusDefinition(scannedParticipant.status).badgeVariant}>
                  {getParticipantStatusDefinition(scannedParticipant.status).label}
                </Badge>
                {scannedParticipant.sync_state === 'pending_sync' && (
                  <Badge variant="secondary">Oczekuje na synchronizację</Badge>
                )}
                {scannedParticipant.sync_state === 'requires_review' && (
                  <Badge variant="destructive">Wymaga weryfikacji</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
                  <div className="mb-3">
                    <p className="text-base font-semibold text-foreground">Dane do weryfikacji</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Najważniejsze informacje potrzebne przy obsłudze uczestnika.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {primaryParticipantFields.filter(field => field.role !== 'email').map(field => (
                      <div
                        key={`primary-${field.role}-${field.label}`}
                        className={`min-h-24 rounded-xl border px-4 py-3 shadow-sm ${
                          field.role === 'important_custom'
                            ? 'border-amber-400/60 bg-amber-500/10'
                            : 'bg-background/90'
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {formatParticipantFieldLabel(field.label)}
                        </p>
                        <p className={`mt-2 break-words text-lg font-bold leading-snug [overflow-wrap:anywhere] ${field.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {field.value || 'Brak danych'}
                        </p>
                      </div>
                    ))}
                    <div className="rounded-xl border bg-background/90 px-4 py-3 shadow-sm md:col-span-2">
                      <div className="flex flex-col gap-3">
                        <Label htmlFor="scanner-inline-bib-number" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Numer startowy
                        </Label>
                        {hasParticipantDataManagementAccess ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              id="scanner-inline-bib-number"
                              value={bibNumberValue}
                              onChange={event => {
                                setBibNumberValue(event.target.value);
                                setBibNumberError(undefined);
                              }}
                              placeholder="Wpisz numer startowy"
                              className="h-12 text-base sm:flex-1"
                              aria-invalid={Boolean(bibNumberError)}
                              aria-describedby={bibNumberError ? 'scanner-inline-bib-number-error' : undefined}
                              disabled={isSavingBibNumber || isReadOnly || !isOnline}
                            />
                            <Button
                              className="h-12 w-full px-5 sm:w-auto"
                              onClick={() => void handleSaveBibNumber()}
                              disabled={
                                isSavingBibNumber
                                || isReadOnly
                                || !isOnline
                                || bibNumberValue.trim() === normalizedCurrentBibNumber
                              }
                            >
                              {isSavingBibNumber ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                              Zapisz numer
                            </Button>
                          </div>
                        ) : (
                          <p className={`break-words text-lg font-bold leading-snug [overflow-wrap:anywhere] ${isScannerBibNumberMissing(scannedParticipant.bib_number) ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {isScannerBibNumberMissing(scannedParticipant.bib_number)
                              ? 'Do uzupełnienia'
                              : formatBibNumber(scannedParticipant.bib_number)}
                          </p>
                        )}
                        <FieldError id="scanner-inline-bib-number-error">
                          {bibNumberError}
                        </FieldError>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5 xl:sticky xl:top-5 xl:self-start">
                  <p className="text-base font-semibold text-foreground">Podsumowanie odprawy</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Numer startowy</p>
                      <p className={`mt-2 break-words text-xl font-black leading-snug tabular-nums [overflow-wrap:anywhere] ${isScannerBibNumberMissing(scannedParticipant.bib_number) ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {isScannerBibNumberMissing(scannedParticipant.bib_number)
                          ? 'Do uzupełnienia'
                          : formatBibNumber(scannedParticipant.bib_number)}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                      <p className="mt-2 break-words text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">{getParticipantStatusDefinition(scannedParticipant.status).label}</p>
                    </div>
                    <div className="rounded-xl border bg-background/90 px-4 py-3 shadow-sm sm:col-span-2 xl:col-span-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ostatnia odprawa</p>
                      <p className="mt-2 break-words text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">{formatScannerDateTime(scannedParticipant.checked_in_at)}</p>
                    </div>
                    {scannedParticipant.sync_state && scannedParticipant.sync_state !== 'synced' && (
                      <div className="rounded-xl border bg-background/90 px-4 py-3 shadow-sm sm:col-span-2 xl:col-span-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Synchronizacja</p>
                        <p className="mt-2 break-words text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
                          {scannedParticipant.sync_state === 'pending_sync' ? 'Oczekuje na synchronizacje' : 'Wymaga weryfikacji'}
                        </p>
                        {scannedParticipant.sync_error && (
                          <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{scannedParticipant.sync_error}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button
                    className="scanner-check-in-action min-h-20 w-full flex-col whitespace-normal rounded-xl px-3 py-4 font-heading text-base font-black uppercase leading-tight tracking-normal sm:col-span-2 sm:min-h-24 sm:px-4 sm:py-5 sm:text-lg xl:col-span-4 [&_svg]:!size-7 sm:[&_svg]:!size-8"
                    onClick={() => void mutateStatus('checked_in', 'Uczestnik odprawiony')}
                    disabled={isMutating || isReadOnly}
                  >
                    {isMutating ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                    ODPRAW ZAWODNIKA
                  </Button>
                )}
                {hasParticipantDataManagementAccess && selectedEvent && (
                  <Button
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => navigate(buildEventParticipantPath(selectedEvent.id, scannedParticipant.id), { state: { openEdit: true } })}
                    disabled={isMutating}
                  >
                    Edytuj dane uczestnika
                  </Button>
                )}
                {scannedParticipant.status !== 'checked_in_not_starting' && (
                  <Button variant="outline" className="h-auto min-h-12 w-full whitespace-normal text-center leading-snug" onClick={() => void mutateStatus('checked_in_not_starting', 'Uczestnik oznaczony jako bez startu')} disabled={isMutating || isReadOnly}>
                    {isMutating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserX2 className="mr-1 h-4 w-4" />}
                    Oznacz jako bez startu
                  </Button>
                )}
                {scannedParticipant.status !== 'not_checked_in' && (
                  <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => void mutateStatus('not_checked_in', 'Odprawa cofnięta')} disabled={isMutating || isReadOnly}>
                    {isMutating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1 h-4 w-4" />}
                    Cofnij odprawę
                  </Button>
                )}
                <Button variant="outline" className="h-12 w-full" onClick={resetToIdle}>
                  Wróć do skanera
                </Button>
              </div>

              {renderFieldGrid(
                'Pozostałe dane uczestnika',
                mappedParticipantFields.usesFallback
                  ? 'Dane zapisane przy uczestniku, gdy mapowanie nie jest aktualnie dostępne.'
                  : 'Pozostałe aktywne pola z mapowania kolumn dla tego wydarzenia.',
                mappedParticipantFields.additional,
              )}
              {!hasRemainingParticipantData && (
                <div className="rounded-2xl border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                  Poza danymi do weryfikacji nie ma dodatkowych pól do pokazania.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={manualBibNumberOpen}
        onOpenChange={nextOpen => {
          setManualBibNumberOpen(nextOpen);
          if (!nextOpen) {
            setBibNumberValue(normalizeScannerBibNumberInput(scannedParticipant?.bib_number));
            setBibNumberError(undefined);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nadaj numer startowy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="scanner-manual-bib-number">Numer startowy</Label>
              <Input
                id="scanner-manual-bib-number"
                value={bibNumberValue}
                onChange={event => {
                  setBibNumberValue(event.target.value);
                  setBibNumberError(undefined);
                }}
                placeholder="Np. 101"
                aria-invalid={Boolean(bibNumberError)}
                aria-describedby={bibNumberError ? 'scanner-manual-bib-number-error' : undefined}
              />
              <FieldError id="scanner-manual-bib-number-error">
                {bibNumberError}
              </FieldError>
            </div>
            <p className="text-sm text-muted-foreground">
              Numer powinien być unikalny w ramach wydarzenia.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={() => void handleSaveBibNumber()}
              disabled={isSavingBibNumber || !bibNumberValue.trim() || isReadOnly || !isOnline}
            >
              {isSavingBibNumber ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Zapisz numer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParticipantBibNumberConflictDialog
        open={bibNumberConflictOpen}
        onOpenChange={handleBibNumberConflictOpenChange}
        bibNumber={pendingBibNumberCandidate}
        conflictingParticipants={bibNumberConflictParticipants}
        allowDeleteConflicts={canUseParticipantAdminConflictActions}
        isSaving={isSavingBibNumber}
        onResolve={handleResolveBibNumberConflict}
      />

      {recentScans.length > 0 && view === 'idle' && (
        <div className="px-4 md:px-0">
          <Card>
            <CardContent className="py-3">
              <button className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setShowRecent(previous => !previous)}>
                <span>Ostatnie ({recentScans.length})</span>
                {showRecent ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showRecent && (
                <div className="mt-2 space-y-1">
                  {recentScans.map(participant => (
                    <div key={participant.id} className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-2 hover:bg-accent/30" onClick={() => { setScannedParticipant(participant); setView('detail'); }}>
                      <span className="min-w-0 truncate font-medium">{participant.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBibNumber(participant.bib_number)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
