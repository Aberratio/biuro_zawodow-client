import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info, Loader2, Undo2, UserX2 } from 'lucide-react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Participant } from '@/types';
import QrScannerView from '@/components/QrScannerView';
import ParticipantSearch from '@/components/ParticipantSearch';
import ScannerSkeleton from '@/components/skeletons/ScannerSkeleton';
import { getParticipantStatusDefinition, participantCountsAsCheckedIn } from '@/lib/participant-status';
import { Navigate } from 'react-router-dom';

type ScannerView = 'idle' | 'success' | 'error' | 'detail';

export default function Scanner() {
  const { participants, selectedEventId, updateParticipantStatus, currentRole, scanParticipantQr, isLoading, visibleEvents } = useMockData();
  const [view, setView] = useState<ScannerView>('idle');
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Nie znaleziono uczestnika dla tego kodu QR.');
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedEvent = visibleEvents.find(event => event.id === selectedEventId) ?? visibleEvents[0] ?? null;
  const activeEventId = selectedEvent?.id ?? selectedEventId;

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === activeEventId),
    [activeEventId, participants]
  );
  const checkedIn = eventParticipants.filter(participantCountsAsCheckedIn).length;
  const canToggleAuto = currentRole !== 'scanner';
  const hasActiveEvents = visibleEvents.length > 0;

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const addToRecent = useCallback((participant: Participant) => {
    setRecentScans(previous => [participant, ...previous.filter(entry => entry.id !== participant.id)].slice(0, 5));
  }, []);

  const showSuccessScreen = useCallback((participant: Participant) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
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
    const result = await scanParticipantQr(decodedText, autoCheckIn);
    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? 'Nie znaleziono uczestnika dla tego kodu QR.');
      setView('error');
      successTimerRef.current = setTimeout(() => setView('idle'), 2500);
      return;
    }

    const participant = result.data.participant;
    if (autoCheckIn && participant.status === 'checked_in') {
      showSuccessScreen(participant);
      return;
    }

    setScannedParticipant(participant);
    addToRecent(participant);
    setView('detail');
  }, [addToRecent, autoCheckIn, scanParticipantQr, showSuccessScreen]);

  const handleSearchSelect = useCallback((participant: Participant) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setScannedParticipant(participant);
    addToRecent(participant);
    setView('detail');
  }, [addToRecent]);

  const resetToIdle = () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setView('idle');
    setScannedParticipant(null);
  };

  const mutateStatus = async (status: Participant['status'], successTitle: string) => {
    if (!scannedParticipant) return;

    setIsMutating(true);
    try {
      const result = await updateParticipantStatus(scannedParticipant.id, status);
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

      toast({ title: successTitle, description: scannedParticipant.name });
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading) return <ScannerSkeleton />;

  if (!hasActiveEvents || !selectedEvent) {
    return <Navigate to="/scanner-info" replace />;
  }

  if (view === 'success' && scannedParticipant) {
    const status = getParticipantStatusDefinition(scannedParticipant.status);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-600 cursor-pointer animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="text-center text-white px-6 space-y-4">
          <CheckCircle className="h-20 w-20 mx-auto" strokeWidth={2.5} />
          <p className="text-4xl md:text-6xl font-black tracking-tight">{status.shortLabel.toUpperCase()}</p>
          <p className="text-2xl md:text-3xl font-bold">{scannedParticipant.name}</p>
          <p className="text-5xl md:text-7xl font-black tabular-nums">#{scannedParticipant.bib_number}</p>
          {scannedParticipant.status === 'checked_in_not_starting' && (
            <p className="text-base opacity-80 mt-4">Pakiet odebrany, uczestnik nie wystartuje</p>
          )}
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-destructive cursor-pointer animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="text-center text-white px-6 space-y-4">
          <AlertTriangle className="h-20 w-20 mx-auto" strokeWidth={2.5} />
          <p className="text-3xl md:text-5xl font-black">BLAD SKANU</p>
          <p className="text-base opacity-80">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg mx-auto -mx-4 md:mx-auto px-0">
      <div className="flex items-center justify-between px-4 md:px-0 gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">Skaner</h1>
          <button className="text-muted-foreground hover:text-foreground transition-colors touch-manipulation" onClick={() => setShowHelp(previous => !previous)} aria-label="Pokaz instrukcje">
            <Info className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {canToggleAuto && (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-muted-foreground">Auto</span>
              <Switch checked={autoCheckIn} onCheckedChange={setAutoCheckIn} />
            </label>
          )}
          <div className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 tabular-nums text-xs sm:text-sm font-bold">
            {checkedIn}/{eventParticipants.length}
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="px-4 md:px-0">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Jak korzystac ze skanera</p>
              <p>Skan QR zawsze weryfikuje kod po stronie API i pilnuje przypisan skanera do wydarzen.</p>
              <p>Tryb auto moze od razu ustawic status "Odprawiony", ale tylko gdy backend potwierdzi poprawny kod.</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="px-4 md:px-0">
        <ParticipantSearch participants={eventParticipants} onSelect={handleSearchSelect} autoFocus={view === 'idle'} />
      </div>

      <div className="px-4 md:px-0">
        <QrScannerView onScan={decodedText => { void handleQrScan(decodedText); }} paused={view !== 'idle'} />
      </div>

      {view === 'detail' && scannedParticipant && (
        <div className="px-4 md:px-0">
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg sm:text-xl font-bold truncate">{scannedParticipant.name}</p>
                <span className="text-xl sm:text-2xl font-black tabular-nums text-primary shrink-0">#{scannedParticipant.bib_number}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getParticipantStatusDefinition(scannedParticipant.status).badgeVariant}>
                  {getParticipantStatusDefinition(scannedParticipant.status).label}
                </Badge>
              </div>
              <div className="grid gap-2">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button className="w-full" onClick={() => void mutateStatus('checked_in', 'Uczestnik odprawiony')} disabled={isMutating}>
                    {isMutating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Odpraw uczestnika
                  </Button>
                )}
                {scannedParticipant.status !== 'checked_in_not_starting' && (
                  <Button variant="outline" className="w-full" onClick={() => void mutateStatus('checked_in_not_starting', 'Uczestnik oznaczony jako bez startu')} disabled={isMutating}>
                    {isMutating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserX2 className="h-4 w-4 mr-1" />}
                    Oznacz jako bez startu
                  </Button>
                )}
                {scannedParticipant.status !== 'not_checked_in' && (
                  <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => void mutateStatus('not_checked_in', 'Odprawa cofnieta')} disabled={isMutating}>
                    {isMutating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Undo2 className="h-4 w-4 mr-1" />}
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
              <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={() => setShowRecent(previous => !previous)}>
                <span>Ostatnie ({recentScans.length})</span>
                {showRecent ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showRecent && (
                <div className="space-y-1 mt-2">
                  {recentScans.map(participant => (
                    <div key={participant.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-accent/30 cursor-pointer" onClick={() => { setScannedParticipant(participant); setView('detail'); }}>
                      <span className="font-medium truncate">{participant.name}</span>
                      <span className="text-xs text-muted-foreground">#{participant.bib_number}</span>
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
