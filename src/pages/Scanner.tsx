import { useState, useCallback, useRef, useEffect } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, Package, AlertTriangle, ChevronDown, ChevronUp, Undo2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Participant } from '@/types';
import QrScannerView from '@/components/QrScannerView';
import ParticipantSearch from '@/components/ParticipantSearch';
import ScannerSkeleton from '@/components/skeletons/ScannerSkeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ScannerView = 'idle' | 'success' | 'error' | 'detail';

export default function Scanner() {
  const { participants, selectedEventId, checkIn, undoCheckIn, collectPackage, currentRole, isLoading } = useMockData();

  const [view, setView] = useState<ScannerView>('idle');
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingParticipant, setPendingParticipant] = useState<Participant | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<Participant | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);
  const canToggleAuto = currentRole !== 'scanner';
  const checkedIn = eventParticipants.filter(p => p.status === 'checked_in').length;

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const addToRecent = useCallback((p: Participant) => {
    setRecentScans(prev => [p, ...prev.filter(x => x.id !== p.id)].slice(0, 5));
  }, []);

  const showSuccessScreen = useCallback((participant: Participant) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    const updated = { ...participant, status: 'checked_in' as const, checked_in_at: new Date().toISOString() };
    setScannedParticipant(updated);
    addToRecent(updated);
    setView('success');
    toast({ title: '✅ Zarejestrowany!', description: participant.name });
    successTimerRef.current = setTimeout(() => {
      setView('idle');
      setScannedParticipant(null);
    }, 1800);
  }, [addToRecent]);

  const handleQrScan = useCallback((decodedText: string) => {
    const found = eventParticipants.find(p => p.qr_code.toLowerCase() === decodedText.toLowerCase());
    if (!found) {
      setView('error');
      successTimerRef.current = setTimeout(() => setView('idle'), 2500);
      return;
    }

    if (autoCheckIn && found.status !== 'checked_in') {
      checkIn(found.id);
      showSuccessScreen(found);
    } else {
      setPendingParticipant(found);
      setConfirmOpen(true);
    }
  }, [eventParticipants, autoCheckIn, checkIn, showSuccessScreen]);

  const handleSearchSelect = useCallback((participant: Participant) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setPendingParticipant(participant);
    setConfirmOpen(true);
  }, []);

  const handleConfirmCheckIn = () => {
    if (!pendingParticipant) return;
    checkIn(pendingParticipant.id);
    showSuccessScreen(pendingParticipant);
    setConfirmOpen(false);
    setPendingParticipant(null);
  };

  const handleViewDetail = () => {
    if (!pendingParticipant) return;
    setScannedParticipant(pendingParticipant);
    addToRecent(pendingParticipant);
    setView('detail');
    setConfirmOpen(false);
    setPendingParticipant(null);
  };

  const handleCollectPackage = () => {
    if (!scannedParticipant) return;
    collectPackage(scannedParticipant.id);
    setScannedParticipant({ ...scannedParticipant, package_status: 'collected' });
    toast({ title: '📦 Pakiet wydany!', description: scannedParticipant.name });
  };

  const handleUndoConfirm = () => {
    if (!undoTarget) return;
    undoCheckIn(undoTarget.id);
    const updated = { ...undoTarget, status: 'pending' as const, checked_in_at: undefined };
    setScannedParticipant(updated);
    addToRecent(updated);
    toast({ title: '↩️ Odprawa cofnięta', description: undoTarget.name });
    setUndoOpen(false);
    setUndoTarget(null);
  };

  const resetToIdle = () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setView('idle');
    setScannedParticipant(null);
  };

  // ── SUCCESS SCREEN ──
  if (view === 'success' && scannedParticipant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-600 cursor-pointer animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="text-center text-white px-6 space-y-3 sm:space-y-4">
          <CheckCircle className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 mx-auto" strokeWidth={2.5} />
          <p className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight">ZAREJESTROWANY</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{scannedParticipant.name}</p>
          <p className="text-4xl sm:text-5xl md:text-7xl font-black tabular-nums">#{scannedParticipant.bib_number}</p>
          {scannedParticipant.package_status === 'not_collected' && (
            <p className="text-base sm:text-lg opacity-80 mt-2 sm:mt-4">📦 Pakiet do wydania</p>
          )}
          <p className="text-xs sm:text-sm opacity-60 mt-4 sm:mt-6">Dotknij aby kontynuować</p>
        </div>
      </div>
    );
  }

  // ── ERROR SCREEN ──
  if (view === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-destructive cursor-pointer animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="text-center text-white px-6 space-y-3 sm:space-y-4">
          <AlertTriangle className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 mx-auto" strokeWidth={2.5} />
          <p className="text-2xl sm:text-3xl md:text-5xl font-black">NIE ZNALEZIONO</p>
          <p className="text-base sm:text-lg opacity-80">Użyj wyszukiwarki ręcznej</p>
          <p className="text-xs sm:text-sm opacity-60 mt-4 sm:mt-6">Dotknij aby wrócić</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg mx-auto -mx-4 md:mx-auto px-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-0 gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">Skaner</h1>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
            onClick={() => setShowHelp(prev => !prev)}
            aria-label="Pokaż instrukcje"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {canToggleAuto && (
            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Auto</span>
              <Switch checked={autoCheckIn} onCheckedChange={setAutoCheckIn} />
            </label>
          )}
          <div className="bg-primary text-primary-foreground rounded-md px-2 sm:px-3 py-1 sm:py-1.5 tabular-nums text-xs sm:text-sm font-bold">
            {checkedIn}/{eventParticipants.length}
          </div>
        </div>
      </div>

      {/* Help / Instructions */}
      {showHelp && (
        <div className="px-4 md:px-0">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Jak korzystać ze skanera:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-none">
                <li>📷 <strong>Skan QR</strong> — skieruj kamerę na kod QR uczestnika</li>
                <li>🔍 <strong>Wyszukiwanie ręczne</strong> — wpisz nazwisko, numer lub email w pole wyszukiwania</li>
                <li>⚡ <strong>Tryb Auto</strong> — {autoCheckIn ? 'włączony: skan QR od razu odprawia' : 'wyłączony: każdy skan wymaga potwierdzenia'}</li>
                <li>📦 <strong>Pakiet</strong> — po odprawie możesz wydać pakiet startowy</li>
                <li>↩️ <strong>Cofnij odprawę</strong> — w szczegółach zawodnika możesz cofnąć odprawę</li>
              </ul>
              {!canToggleAuto && (
                <p className="text-[10px] text-muted-foreground/70 pt-1">
                  💡 Tryb Auto jest zarządzany przez organizatora.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Autocomplete search */}
      <div className="px-4 md:px-0">
        <ParticipantSearch participants={eventParticipants} onSelect={handleSearchSelect} autoFocus={view === 'idle'} />
      </div>

      {/* QR Camera Scanner */}
      <div className="px-4 md:px-0">
        <QrScannerView onScan={handleQrScan} paused={view !== 'idle'} />
      </div>

      {/* Detail view */}
      {view === 'detail' && scannedParticipant && (
        <div className="px-4 md:px-0">
          {scannedParticipant.status === 'checked_in' ? (
            <div className="rounded-lg bg-destructive/10 border-2 border-destructive p-3 sm:p-4 mb-3">
              <p className="text-center text-lg sm:text-xl md:text-2xl font-black text-destructive">🔴 JUŻ ODPRAWIONY</p>
              <p className="text-center text-xs sm:text-sm text-muted-foreground mt-1">
                {scannedParticipant.checked_in_at && new Date(scannedParticipant.checked_in_at).toLocaleTimeString('pl-PL')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-500/10 border-2 border-emerald-500 p-3 sm:p-4 mb-3">
              <p className="text-center text-lg sm:text-xl md:text-2xl font-black text-emerald-600">🟢 GOTOWY DO ODPRAWY</p>
            </div>
          )}

          <Card>
            <CardContent className="py-3 sm:py-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg sm:text-xl font-bold truncate">{scannedParticipant.name}</p>
                <span className="text-xl sm:text-2xl font-black tabular-nums text-primary shrink-0">#{scannedParticipant.bib_number}</span>
              </div>
              <div className="space-y-2">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button className="w-full h-14 sm:h-16 text-base sm:text-lg font-bold touch-manipulation" onClick={() => {
                    setPendingParticipant(scannedParticipant);
                    setConfirmOpen(true);
                  }}>
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2" /> Odpraw zawodnika
                  </Button>
                )}
                {scannedParticipant.package_status !== 'collected' && (
                  <Button variant="outline" className="w-full h-11 sm:h-12 text-sm font-semibold touch-manipulation" onClick={handleCollectPackage}>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> Wydaj pakiet
                  </Button>
                )}
                {scannedParticipant.status === 'checked_in' && (
                  <Button
                    variant="outline"
                    className="w-full h-10 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 touch-manipulation"
                    onClick={() => { setUndoTarget(scannedParticipant); setUndoOpen(true); }}
                  >
                    <Undo2 className="h-4 w-4 mr-1.5" /> Cofnij odprawę
                  </Button>
                )}
                {scannedParticipant.status === 'checked_in' && scannedParticipant.package_status === 'collected' && (
                  <p className="text-center text-sm text-primary font-semibold py-2">✅ Wszystko gotowe</p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground touch-manipulation" onClick={resetToIdle}>
                ← Wróć do skanowania
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent scans */}
      {recentScans.length > 0 && view === 'idle' && (
        <div className="px-4 md:px-0">
          <Card>
            <CardContent className="py-3">
              <button className="flex items-center justify-between w-full text-sm font-semibold touch-manipulation" onClick={() => setShowRecent(prev => !prev)}>
                <span>Ostatnie ({recentScans.length})</span>
                {showRecent ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showRecent && (
                <div className="space-y-0.5 mt-2">
                  {recentScans.map(p => {
                    const current = participants.find(pp => pp.id === p.id) || p;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2.5 text-sm cursor-pointer hover:bg-accent/30 active:bg-accent/50 px-2 rounded touch-manipulation"
                        onClick={() => {
                          if (successTimerRef.current) clearTimeout(successTimerRef.current);
                          setScannedParticipant(current);
                          setView('detail');
                        }}
                      >
                        <span className="font-medium truncate">
                          {current.name} <span className="text-muted-foreground tabular-nums">#{current.bib_number}</span>
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          current.status === 'checked_in' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                        }`}>
                          {current.status === 'checked_in' ? '✓' : '○'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* No participants hint */}
      {eventParticipants.length === 0 && view === 'idle' && (
        <div className="px-4 md:px-0">
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">Brak uczestników w tym wydarzeniu</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Zaimportuj uczestników lub wybierz inne wydarzenie w nagłówku.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation modal */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">
              {pendingParticipant?.status === 'checked_in' ? 'Zawodnik już odprawiony' : 'Potwierdź odprawę'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                {pendingParticipant && (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm sm:text-base font-semibold text-foreground">{pendingParticipant.name}</span>
                      <span className="text-base sm:text-lg font-black tabular-nums text-primary">#{pendingParticipant.bib_number}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{pendingParticipant.email}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        pendingParticipant.status === 'checked_in' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        {pendingParticipant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        pendingParticipant.package_status === 'collected' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {pendingParticipant.package_status === 'collected' ? 'Pakiet wydany' : 'Pakiet do wydania'}
                      </span>
                    </div>
                    {pendingParticipant.status === 'checked_in' && (
                      <p className="text-sm font-semibold text-destructive">Ten zawodnik jest już odprawiony.</p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <AlertDialogCancel className="touch-manipulation h-11 sm:h-10">Anuluj</AlertDialogCancel>
            {pendingParticipant?.status !== 'checked_in' ? (
              <AlertDialogAction className="h-12 sm:h-12 text-base font-bold touch-manipulation" onClick={handleConfirmCheckIn}>
                <CheckCircle className="h-5 w-5 mr-2" /> Potwierdź odprawę
              </AlertDialogAction>
            ) : (
              <AlertDialogAction className="touch-manipulation h-11 sm:h-10" onClick={handleViewDetail}>
                Pokaż szczegóły
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo check-in confirmation modal */}
      <AlertDialog open={undoOpen} onOpenChange={setUndoOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl text-destructive">Cofnij odprawę</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                {undoTarget && (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm sm:text-base font-semibold text-foreground">{undoTarget.name}</span>
                      <span className="text-base sm:text-lg font-black tabular-nums text-primary">#{undoTarget.bib_number}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Czy na pewno chcesz cofnąć odprawę tego zawodnika?
                    </p>
                    <p className="text-xs text-destructive/80">
                      Ta akcja zmieni status z <strong>checked_in</strong> na <strong>pending</strong>.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <AlertDialogCancel className="touch-manipulation h-11 sm:h-10">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-12 text-base font-bold touch-manipulation"
              onClick={handleUndoConfirm}
            >
              <Undo2 className="h-5 w-5 mr-2" /> Tak, cofnij odprawę
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
