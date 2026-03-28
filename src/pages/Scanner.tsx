import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info, Loader2, Package, Undo2 } from 'lucide-react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Participant } from '@/types';
import QrScannerView from '@/components/QrScannerView';
import ParticipantSearch from '@/components/ParticipantSearch';
import ScannerSkeleton from '@/components/skeletons/ScannerSkeleton';

type ScannerView = 'idle' | 'success' | 'error' | 'detail';

export default function Scanner() {
  const { participants, selectedEventId, checkIn, undoCheckIn, collectPackage, currentRole, scanParticipantQr, isLoading } = useMockData();
  const [view, setView] = useState<ScannerView>('idle');
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Nie znaleziono uczestnika dla tego kodu QR.');
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === selectedEventId),
    [participants, selectedEventId]
  );
  const checkedIn = eventParticipants.filter(participant => participant.status === 'checked_in').length;
  const canToggleAuto = currentRole !== 'scanner';

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

  const handleCheckIn = async () => {
    if (!scannedParticipant) return;
    setIsMutating(true);
    try {
      const result = await checkIn(scannedParticipant.id);
      if (!result.ok) {
        toast({ title: 'Nie udało się odprawić zawodnika', description: result.error, variant: 'destructive' });
        return;
      }

      showSuccessScreen({ ...scannedParticipant, status: 'checked_in', checked_in_at: new Date().toISOString() });
    } finally {
      setIsMutating(false);
    }
  };

  const handleCollectPackage = async () => {
    if (!scannedParticipant) return;
    setIsMutating(true);
    try {
      const result = await collectPackage(scannedParticipant.id);
      if (!result.ok) {
        toast({ title: 'Nie udało się wydać pakietu', description: result.error, variant: 'destructive' });
        return;
      }

      setScannedParticipant(previous => previous ? { ...previous, package_status: 'collected' } : previous);
      toast({ title: 'Pakiet wydany', description: scannedParticipant.name });
    } finally {
      setIsMutating(false);
    }
  };

  const handleUndoCheckIn = async () => {
    if (!scannedParticipant) return;
    setIsMutating(true);
    try {
      const result = await undoCheckIn(scannedParticipant.id);
      if (!result.ok) {
        toast({ title: 'Nie udało się cofnąć odprawy', description: result.error, variant: 'destructive' });
        return;
      }

      setScannedParticipant(previous => previous ? { ...previous, status: 'pending', checked_in_at: undefined } : previous);
      toast({ title: 'Odprawa cofnięta', description: scannedParticipant.name });
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading) return <ScannerSkeleton />;

  if (view === 'success' && scannedParticipant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-600 cursor-pointer animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="text-center text-white px-6 space-y-4">
          <CheckCircle className="h-20 w-20 mx-auto" strokeWidth={2.5} />
          <p className="text-4xl md:text-6xl font-black tracking-tight">ZAREJESTROWANY</p>
          <p className="text-2xl md:text-3xl font-bold">{scannedParticipant.name}</p>
          <p className="text-5xl md:text-7xl font-black tabular-nums">#{scannedParticipant.bib_number}</p>
          {scannedParticipant.package_status === 'not_collected' && (
            <p className="text-base opacity-80 mt-4">Pakiet do wydania</p>
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
          <p className="text-3xl md:text-5xl font-black">BŁĄD SKANU</p>
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
          <button className="text-muted-foreground hover:text-foreground transition-colors touch-manipulation" onClick={() => setShowHelp(previous => !previous)} aria-label="Pokaż instrukcje">
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
              <p className="font-semibold text-foreground">Jak korzystać ze skanera</p>
              <p>Skan QR zawsze weryfikuje kod po stronie API i pilnuje przypisań skanera do wydarzeń.</p>
              <p>Tryb auto może od razu wykonać check-in, ale tylko gdy backend potwierdzi poprawny kod.</p>
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
                <Badge variant={scannedParticipant.status === 'checked_in' ? 'default' : 'secondary'}>
                  {scannedParticipant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                </Badge>
                <Badge variant={scannedParticipant.package_status === 'collected' ? 'default' : 'outline'}>
                  {scannedParticipant.package_status === 'collected' ? 'Pakiet wydany' : 'Pakiet do wydania'}
                </Badge>
              </div>
              <div className="grid gap-2">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button className="w-full" onClick={() => void handleCheckIn()} disabled={isMutating}>
                    {isMutating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Odpraw zawodnika
                  </Button>
                )}
                {scannedParticipant.package_status !== 'collected' && (
                  <Button variant="outline" className="w-full" onClick={() => void handleCollectPackage()} disabled={isMutating}>
                    {isMutating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Package className="h-4 w-4 mr-1" />}
                    Wydaj pakiet
                  </Button>
                )}
                {scannedParticipant.status === 'checked_in' && (
                  <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => void handleUndoCheckIn()} disabled={isMutating}>
                    {isMutating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Undo2 className="h-4 w-4 mr-1" />}
                    Cofnij odprawę
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
