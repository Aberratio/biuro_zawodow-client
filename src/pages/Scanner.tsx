import { useState, useCallback } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScanLine, CheckCircle, Package, AlertTriangle, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Participant } from '@/types';

export default function Scanner() {
  const { participants, selectedEventId, checkIn, collectPackage } = useMockData();
  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [scanError, setScanError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const simulateScan = useCallback((valid: boolean) => {
    setScanning(true);
    setScanError(false);
    setScannedParticipant(null);
    setTimeout(() => {
      setScanning(false);
      if (valid) {
        const pending = eventParticipants.filter(p => p.status === 'pending');
        const target = pending.length > 0 ? pending[Math.floor(Math.random() * pending.length)] : eventParticipants[Math.floor(Math.random() * eventParticipants.length)];
        if (target) {
          setScannedParticipant(target);
          setRecentScans(prev => [target, ...prev.filter(p => p.id !== target.id)].slice(0, 10));
        }
      } else {
        setScanError(true);
      }
    }, 800);
  }, [eventParticipants]);

  const handleSearch = useCallback(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;
    const found = eventParticipants.find(p =>
      p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.bib_number === q || p.qr_code.toLowerCase() === q.toLowerCase()
    );
    if (found) {
      setScannedParticipant(found);
      setScanError(false);
      setRecentScans(prev => [found, ...prev.filter(p => p.id !== found.id)].slice(0, 10));
    } else {
      setScanError(true);
      setScannedParticipant(null);
    }
    setSearchQuery('');
  }, [searchQuery, eventParticipants]);

  const handleCheckIn = () => {
    if (!scannedParticipant) return;
    checkIn(scannedParticipant.id);
    setScannedParticipant({ ...scannedParticipant, status: 'checked_in', checked_in_at: new Date().toISOString() });
    toast({ title: '✅ Uczestnik odprawiony!', description: scannedParticipant.name });
  };

  const handleCollectPackage = () => {
    if (!scannedParticipant) return;
    collectPackage(scannedParticipant.id);
    setScannedParticipant({ ...scannedParticipant, package_status: 'collected' });
    toast({ title: '📦 Pakiet wydany!', description: scannedParticipant.name });
  };

  const checkedIn = eventParticipants.filter(p => p.status === 'checked_in').length;

  return (
    <div className="space-y-3 md:space-y-4 max-w-lg mx-auto -mx-4 md:mx-auto px-0 md:px-0">
      {/* Compact header for mobile */}
      <div className="flex items-center justify-between px-4 md:px-0">
        <h1 className="text-lg md:text-2xl font-bold tracking-tight">Skaner QR</h1>
        <Badge variant="secondary" className="tabular-nums text-sm font-bold px-3 py-1">
          {checkedIn}/{eventParticipants.length}
        </Badge>
      </div>

      {/* Mock camera viewfinder — shorter on mobile */}
      <Card className="overflow-hidden rounded-none md:rounded-lg border-x-0 md:border-x">
        <div className="relative bg-foreground/5 aspect-[16/9] md:aspect-[4/3] flex items-center justify-center">
          <div className={`absolute inset-4 md:inset-8 border-2 border-dashed rounded-lg transition-colors ${scanning ? 'border-primary animate-pulse' : 'border-muted-foreground/30'}`} />
          {/* Corner markers */}
          <div className="absolute inset-4 md:inset-8 pointer-events-none">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
          </div>
          <div className="text-center z-10">
            <ScanLine className={`h-10 w-10 md:h-12 md:w-12 mx-auto mb-1 ${scanning ? 'text-primary animate-pulse' : 'text-muted-foreground/40'}`} />
            <p className="text-xs md:text-sm text-muted-foreground">{scanning ? 'Skanowanie...' : 'Skieruj kamerę na kod QR'}</p>
          </div>
        </div>
        <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12 md:h-14 text-xs md:text-sm font-semibold touch-manipulation" onClick={() => simulateScan(true)} disabled={scanning}>
              <CheckCircle className="h-4 w-4 md:h-5 md:w-5 mr-1.5" /> Poprawny skan
            </Button>
            <Button variant="destructive" className="h-12 md:h-14 text-xs md:text-sm font-semibold touch-manipulation" onClick={() => simulateScan(false)} disabled={scanning}>
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 mr-1.5" /> Błędny skan
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Imię, email lub numer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-10 text-base md:text-sm"
            />
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 touch-manipulation" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan error */}
      {scanError && (
        <div className="mx-4 md:mx-0">
          <Card className="border-destructive">
            <CardContent className="py-4 md:pt-6 text-center">
              <AlertTriangle className="h-8 w-8 md:h-10 md:w-10 text-destructive mx-auto mb-2" />
              <p className="font-semibold text-destructive text-sm">Nie znaleziono uczestnika</p>
              <p className="text-xs text-muted-foreground mt-1">Sprawdź kod QR lub wyszukaj ręcznie</p>
              <Button variant="ghost" size="sm" className="mt-2 touch-manipulation" onClick={() => setScanError(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Zamknij
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scan result — optimized for quick actions on mobile */}
      {scannedParticipant && (
        <div className="mx-4 md:mx-0">
          <Card className={scannedParticipant.status === 'checked_in' ? 'border-primary bg-primary/5' : 'border-2'}>
            <CardContent className="py-4 md:pt-6 space-y-3 md:space-y-4">
              {scannedParticipant.status === 'checked_in' && (
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <CheckCircle className="h-5 w-5" /> Już odprawiony
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-lg md:text-xl font-bold truncate">{scannedParticipant.name}</p>
                  <span className="text-base font-bold tabular-nums text-primary shrink-0">#{scannedParticipant.bib_number}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{scannedParticipant.email}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={scannedParticipant.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                    {scannedParticipant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                  </Badge>
                  <Badge variant={scannedParticipant.package_status === 'collected' ? 'default' : 'outline'} className="text-[10px]">
                    {scannedParticipant.package_status === 'collected' ? 'Pakiet wydany' : 'Pakiet nie wydany'}
                  </Badge>
                </div>
              </div>
              {/* Large touch-friendly action buttons */}
              <div className="grid grid-cols-1 gap-2">
                {scannedParticipant.status !== 'checked_in' && (
                  <Button className="h-14 md:h-16 text-base font-bold touch-manipulation" onClick={handleCheckIn}>
                    <CheckCircle className="h-6 w-6 mr-2" /> Oznacz obecność
                  </Button>
                )}
                {scannedParticipant.package_status !== 'collected' && (
                  <Button variant="outline" className="h-14 md:h-16 text-base font-bold touch-manipulation" onClick={handleCollectPackage}>
                    <Package className="h-6 w-6 mr-2" /> Wydaj pakiet
                  </Button>
                )}
                {scannedParticipant.status === 'checked_in' && scannedParticipant.package_status === 'collected' && (
                  <p className="text-center text-sm text-primary font-semibold py-3">✅ Wszystko gotowe!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent scans — collapsible on mobile */}
      {recentScans.length > 0 && (
        <div className="mx-4 md:mx-0">
          <Card>
            <CardContent className="py-3 md:pt-6">
              <button
                className="flex items-center justify-between w-full text-sm font-semibold mb-0 md:mb-3 md:cursor-default touch-manipulation"
                onClick={() => setShowRecent(prev => !prev)}
              >
                <span>Ostatnio zeskanowani ({recentScans.length})</span>
                <span className="md:hidden">
                  {showRecent ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </span>
              </button>
              <div className={`space-y-1 overflow-hidden transition-all ${showRecent ? 'max-h-[500px] mt-2' : 'max-h-0 md:max-h-[500px] md:mt-0'}`}>
                {recentScans.map(p => {
                  const current = participants.find(pp => pp.id === p.id) || p;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-2.5 md:py-1.5 text-sm cursor-pointer hover:bg-accent/30 active:bg-accent/50 px-2 rounded touch-manipulation"
                      onClick={() => { setScannedParticipant(current); setScanError(false); }}
                    >
                      <span className="font-medium truncate">
                        {current.name} <span className="text-muted-foreground">#{current.bib_number}</span>
                      </span>
                      <Badge variant={current.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px] shrink-0 ml-2">
                        {current.status === 'checked_in' ? '✓' : '○'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
