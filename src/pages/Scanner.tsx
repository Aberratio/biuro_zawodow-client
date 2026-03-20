import { useState, useCallback, useRef, useEffect } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, Package, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Participant } from '@/types';
import QrScannerView from '@/components/QrScannerView';
import ParticipantSearch from '@/components/ParticipantSearch';

type ScannerView = 'idle' | 'success' | 'error' | 'detail';

export default function Scanner() {
  const { participants, selectedEventId, checkIn, collectPackage, currentRole } = useMockData();
  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);

  const [view, setView] = useState<ScannerView>('idle');
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [showRecent, setShowRecent] = useState(true);

  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const canToggleAuto = currentRole !== 'scanner';

  const checkedIn = eventParticipants.filter(p => p.status === 'checked_in').length;

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const addToRecent = useCallback((p: Participant) => {
    setRecentScans(prev => [p, ...prev.filter(x => x.id !== p.id)].slice(0, 5));
  }, []);

  const handleSuccess = useCallback((participant: Participant) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);

    if (autoCheckIn && participant.status !== 'checked_in') {
      checkIn(participant.id);
      const updated = { ...participant, status: 'checked_in' as const, checked_in_at: new Date().toISOString() };
      setScannedParticipant(updated);
      addToRecent(updated);
      setView('success');
      toast({ title: '✅ Zarejestrowany!', description: participant.name });

      successTimerRef.current = setTimeout(() => {
        setView('idle');
        setScannedParticipant(null);
      }, 1800);
    } else {
      setScannedParticipant(participant);
      addToRecent(participant);
      setView('detail');
    }
  }, [autoCheckIn, checkIn, addToRecent]);

  const handleQrScan = useCallback((decodedText: string) => {
    const found = eventParticipants.find(p => p.qr_code.toLowerCase() === decodedText.toLowerCase());
    if (found) {
      handleSuccess(found);
    } else {
      setView('error');
      successTimerRef.current = setTimeout(() => setView('idle'), 2500);
    }
  }, [eventParticipants, handleSuccess]);

  const handleSearchSelect = useCallback((participant: Participant) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    handleSuccess(participant);
  }, [handleSuccess]);

  const handleCheckIn = () => {
    if (!scannedParticipant) return;
    checkIn(scannedParticipant.id);
    const updated = { ...scannedParticipant, status: 'checked_in' as const, checked_in_at: new Date().toISOString() };
    setScannedParticipant(updated);
    addToRecent(updated);
    toast({ title: '✅ Zarejestrowany!', description: scannedParticipant.name });
    setView('success');
    successTimerRef.current = setTimeout(() => {
      setView('idle');
      setScannedParticipant(null);
    }, 1800);
  };

  const handleCollectPackage = () => {
    if (!scannedParticipant) return;
    collectPackage(scannedParticipant.id);
    setScannedParticipant({ ...scannedParticipant, package_status: 'collected' });
    toast({ title: '📦 Pakiet wydany!', description: scannedParticipant.name });
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
        <div className="text-center text-white px-6 space-y-4">
          <CheckCircle className="h-20 w-20 md:h-24 md:w-24 mx-auto" strokeWidth={2.5} />
          <p className="text-4xl md:text-6xl font-black tracking-tight">ZAREJESTROWANY</p>
          <p className="text-2xl md:text-3xl font-bold">{scannedParticipant.name}</p>
          <p className="text-5xl md:text-7xl font-black tabular-nums">#{scannedParticipant.bib_number}</p>
          {scannedParticipant.package_status === 'not_collected' && (
            <p className="text-lg opacity-80 mt-4">📦 Pakiet do wydania</p>
          )}
          <p className="text-sm opacity-60 mt-6">Dotknij aby kontynuować</p>
        </div>
      </div>
    );
  }

  // ── ERROR SCREEN ──
  if (view === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-destructive cursor-pointer animate-in fade-in duration-200" onClick={resetToIdle}>
        <div className="text-center text-white px-6 space-y-4">
          <AlertTriangle className="h-20 w-20 md:h-24 md:w-24 mx-auto" strokeWidth={2.5} />
          <p className="text-3xl md:text-5xl font-black">NIE ZNALEZIONO</p>
          <p className="text-lg opacity-80">Użyj wyszukiwarki ręcznej</p>
          <p className="text-sm opacity-60 mt-6">Dotknij aby wrócić</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg mx-auto -mx-4 md:mx-auto px-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-0 gap-2">
        <h1 className="text-lg md:text-2xl font-bold tracking-tight">Skaner</h1>
        <div className="flex items-center gap-3">
          {canToggleAuto && (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-muted-foreground">Auto</span>
              <Switch checked={autoCheckIn} onCheckedChange={setAutoCheckIn} />
            </label>
          )}
          <div className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 tabular-nums text-sm font-bold">
            {checkedIn}/{eventParticipants.length}
          </div>
        </div>
      </div>

      {/* Autocomplete search */}
      <div className="px-4 md:px-0">
        <ParticipantSearch
          participants={eventParticipants}
          onSelect={handleSearchSelect}
          autoFocus={view === 'idle'}
        />
      </div>

      {/* QR Camera Scanner */}
      <div className="px-4 md:px-0">
        <QrScannerView
          onScan={handleQrScan}
          paused={view !== 'idle'}
        />
      </div>

      {/* Detail view */}
      {view === 'detail' && scannedParticipant && (
        <div className="px-4 md:px-0">
          {scannedParticipant.status === 'checked_in' ? (
            <div className="rounded-lg bg-destructive/10 border-2 border-destructive p-4 mb-3">
              <p className="text-center text-xl md:text-2xl font-black text-destructive">🔴 JUŻ ODPRAWIONY</p>
              <p className="text-center text-sm text-muted-foreground mt-1">
                {scannedParticipant.checked_in_at && new Date(scannedParticipant.checked_in_at).toLocaleTimeString('pl-PL')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-500/10 border-2 border-emerald-500 p-4 mb-3">
              <p className="text-center text-xl md:text-2xl font-black text-emerald-600">🟢 GOTOWY DO ODPRAWY</p>
            </div>
          )}

          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xl font-bold truncate">{scannedParticipant.name}</p>
                <span className="text-2xl font-black tabular-nums text-primary shrink-0">#{scannedParticipant.bib_number}</span>
              </div>
              <div className="space-y-2">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button className="w-full h-16 text-lg font-bold touch-manipulation" onClick={handleCheckIn}>
                    <CheckCircle className="h-6 w-6 mr-2" /> Odpraw zawodnika
                  </Button>
                )}
                {scannedParticipant.package_status !== 'collected' && (
                  <Button variant="outline" className="w-full h-12 text-sm font-semibold touch-manipulation" onClick={handleCollectPackage}>
                    <Package className="h-5 w-5 mr-2" /> Wydaj pakiet
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
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
    </div>
  );
}
