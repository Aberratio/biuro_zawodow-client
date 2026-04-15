import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2, Undo2, UserX2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import type { Participant } from '@/types';
import QrScannerView from '@/components/QrScannerView';
import ParticipantSearch from '@/components/ParticipantSearch';
import ScannerSkeleton from '@/components/skeletons/ScannerSkeleton';
import { getParticipantStatusDefinition } from '@/lib/participant-status';
import { formatEventOfficeWindow, isEventOfficeOpen } from '@/lib/events';
import { isScannerRole } from '@/lib/roles';

type ScannerView = 'idle' | 'success' | 'error' | 'detail';

export default function Scanner() {
  const {
    participants,
    selectedEventId,
    selectedOrganizationId,
    updateParticipantStatus,
    currentRole,
    scanParticipantQr,
    isLoading,
    visibleEvents,
    connectionState,
    pendingMutationCount,
    scannerMode,
  } = useData();
  const [view, setView] = useState<ScannerView>('idle');
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [showRecent, setShowRecent] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Nie znaleziono uczestnika dla tego kodu QR.');
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedEvent = visibleEvents.find(event => event.id === selectedEventId) ?? null;
  const scannerAvailable = selectedEvent !== null && isEventOfficeOpen(selectedEvent);
  const activeEventId = selectedEvent?.id ?? selectedEventId;
  const isReadOnly = scannerMode === 'read_only';
  const isOfflineQueue = scannerMode === 'offline_queue';

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

  const addToRecent = useCallback((participant: Participant) => {
    setRecentScans(previous => [participant, ...previous.filter(entry => entry.id !== participant.id)].slice(0, 5));
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
        description: 'Polaczenie bylo zbyt dlugo niedostepne albo kolejka zmian jest zbyt dluga.',
        variant: 'destructive',
      });
      return;
    }

    setIsMutating(true);
    try {
      const result = await updateParticipantStatus(scannedParticipant.id, status, { allowOfflineQueue: true });
      if (!result.ok) {
        toast({ title: 'Nie udalo sie zaktualizowac statusu', description: result.error, variant: 'destructive' });
        return;
      }

      const updatedParticipant: Participant = {
        ...scannedParticipant,
        status,
        checked_in_at: status === 'not_checked_in' ? undefined : (scannedParticipant.checked_in_at ?? new Date().toISOString()),
      };

      if (status === 'not_checked_in') {
        setScannedParticipant(updatedParticipant);
      } else {
        showSuccessScreen(updatedParticipant);
      }

      toast({
        title: connectionState === 'online' ? successTitle : 'Zmiana zapisana lokalnie',
        description: connectionState === 'online'
          ? scannedParticipant.name
          : `${scannedParticipant.name} czeka na synchronizacje po odzyskaniu polaczenia.`,
      });
    } finally {
      setIsMutating(false);
    }
  }, [connectionState, isReadOnly, scannedParticipant, showSuccessScreen, updateParticipantStatus]);

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
                ? 'Do wybranej organizacji nie dodano jeszcze wydarzen. Dodaj je w zakladce Wydarzenia.'
                : 'Wybierz wydarzenie z menu bocznego, aby uruchomic skaner.'}
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
            <p className="text-base font-semibold">Skaner jest teraz niedostepny</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Skaner mozna uruchomic tylko w godzinach otwarcia biura zawodow dla wybranego wydarzenia.
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
        <div className="max-w-md space-y-4 px-6 text-center text-white">
          <CheckCircle className="mx-auto h-16 w-16 sm:h-20 sm:w-20" strokeWidth={2.5} />
          <p className="font-heading text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">{status.shortLabel.toUpperCase()}</p>
          <p className="break-words text-xl font-bold sm:text-2xl md:text-3xl">{scannedParticipant.name}</p>
          <p className="font-mono text-4xl font-black tabular-nums sm:text-5xl md:text-7xl">#{scannedParticipant.bib_number}</p>
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
          <p className="text-3xl font-black sm:text-4xl md:text-5xl">BLAD SKANU</p>
          <p className="text-sm opacity-80 sm:text-base">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="px-4 md:px-0">
        <h1 className="font-heading text-lg font-bold tracking-tight md:text-2xl">Skaner</h1>
        {(connectionState !== 'online' || pendingMutationCount > 0) && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${isReadOnly ? 'border-amber-500/40 bg-amber-500/10 text-amber-950' : 'border-sky-500/30 bg-sky-500/10 text-sky-950'}`}>
            <p className="font-semibold">
              {isReadOnly
                ? 'Tryb tylko do odczytu'
                : isOfflineQueue
                  ? 'Tryb offline z kolejka synchronizacji'
                  : 'Oczekiwanie na synchronizacje'}
            </p>
            <p className="mt-1 text-current/80">
              {isReadOnly
                ? 'Dalsze zmiany statusow sa zablokowane, zeby nie pracowac na zbyt starych danych.'
                : connectionState === 'online'
                  ? `W kolejce czeka ${pendingMutationCount} ${pendingMutationCount === 1 ? 'zmiana' : 'zmian'} statusu.`
                  : 'Skaner rozpoznaje uczestnikow lokalnie i zapisuje zmiany do wyslania po odzyskaniu polaczenia.'}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 md:px-0">
        <ParticipantSearch participants={eventParticipants} onSelect={handleSearchSelect} autoFocus={view === 'idle'} />
      </div>

      <div className="px-4 md:px-0">
        <QrScannerView onScan={decodedText => { void handleQrScan(decodedText); }} paused={view !== 'idle'} />
      </div>

      {view === 'detail' && scannedParticipant && (
        <div className="px-4 md:px-0">
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-lg font-bold sm:text-xl">{scannedParticipant.name}</p>
                <span className="shrink-0 text-xl font-black tabular-nums text-primary sm:text-2xl">#{scannedParticipant.bib_number}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getParticipantStatusDefinition(scannedParticipant.status).badgeVariant}>
                  {getParticipantStatusDefinition(scannedParticipant.status).label}
                </Badge>
                {scannedParticipant.sync_state === 'pending_sync' && (
                  <Badge variant="secondary">Oczekuje na synchronizacje</Badge>
                )}
                {scannedParticipant.sync_state === 'requires_review' && (
                  <Badge variant="destructive">Wymaga weryfikacji</Badge>
                )}
              </div>
              <div className="grid gap-2">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button className="w-full" onClick={() => void mutateStatus('checked_in', 'Uczestnik odprawiony')} disabled={isMutating || isReadOnly}>
                    {isMutating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                    Odpraw uczestnika
                  </Button>
                )}
                {scannedParticipant.status !== 'checked_in_not_starting' && (
                  <Button variant="outline" className="w-full" onClick={() => void mutateStatus('checked_in_not_starting', 'Uczestnik oznaczony jako bez startu')} disabled={isMutating || isReadOnly}>
                    {isMutating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserX2 className="mr-1 h-4 w-4" />}
                    Oznacz jako bez startu
                  </Button>
                )}
                {scannedParticipant.status !== 'not_checked_in' && (
                  <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => void mutateStatus('not_checked_in', 'Odprawa cofnieta')} disabled={isMutating || isReadOnly}>
                    {isMutating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1 h-4 w-4" />}
                    Cofnij odprawe
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                      <span className="shrink-0 text-xs text-muted-foreground">#{participant.bib_number}</span>
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
