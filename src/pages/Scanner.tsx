import { useState, useCallback } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScanLine, CheckCircle, Package, AlertTriangle, Search, X } from 'lucide-react';
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
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Skaner QR</h1>
        <Badge variant="secondary" className="tabular-nums text-sm">{checkedIn}/{eventParticipants.length}</Badge>
      </div>

      {/* Mock camera viewfinder */}
      <Card className="overflow-hidden">
        <div className="relative bg-foreground/5 aspect-[4/3] flex items-center justify-center">
          <div className={`absolute inset-8 border-2 border-dashed rounded-lg transition-colors ${scanning ? 'border-primary animate-pulse' : 'border-muted-foreground/30'}`} />
          <div className="text-center z-10">
            <ScanLine className={`h-12 w-12 mx-auto mb-2 ${scanning ? 'text-primary animate-pulse' : 'text-muted-foreground/50'}`} />
            <p className="text-sm text-muted-foreground">{scanning ? 'Skanowanie...' : 'Symulacja kamery'}</p>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="h-14 text-sm font-semibold" onClick={() => simulateScan(true)} disabled={scanning}>
              <CheckCircle className="h-5 w-5 mr-2" /> Poprawny skan
            </Button>
            <Button size="lg" variant="destructive" className="h-14 text-sm font-semibold" onClick={() => simulateScan(false)} disabled={scanning}>
              <AlertTriangle className="h-5 w-5 mr-2" /> Błędny skan
            </Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Szukaj: imię, email, numer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <Button variant="outline" size="icon" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan result */}
      {scanError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="font-semibold text-destructive">Nie znaleziono uczestnika</p>
            <p className="text-sm text-muted-foreground mt-1">Sprawdź kod QR lub wyszukaj ręcznie</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setScanError(false)}><X className="h-3.5 w-3.5 mr-1" /> Zamknij</Button>
          </CardContent>
        </Card>
      )}

      {scannedParticipant && (
        <Card className={scannedParticipant.status === 'checked_in' ? 'border-primary bg-primary/5' : 'border-2'}>
          <CardContent className="pt-6 space-y-4">
            {scannedParticipant.status === 'checked_in' && (
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle className="h-5 w-5" /> Już odprawiony
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xl font-bold">{scannedParticipant.name}</p>
              <p className="text-sm text-muted-foreground">{scannedParticipant.email}</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">#{scannedParticipant.bib_number}</span>
                <Badge variant={scannedParticipant.status === 'checked_in' ? 'default' : 'secondary'}>
                  {scannedParticipant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                </Badge>
                <Badge variant={scannedParticipant.package_status === 'collected' ? 'default' : 'outline'}>
                  {scannedParticipant.package_status === 'collected' ? 'Pakiet wydany' : 'Pakiet nie wydany'}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {scannedParticipant.status !== 'checked_in' && (
                <Button size="lg" className="h-16 text-base font-bold" onClick={handleCheckIn}>
                  <CheckCircle className="h-6 w-6 mr-2" /> Oznacz obecność
                </Button>
              )}
              {scannedParticipant.package_status !== 'collected' && (
                <Button size="lg" variant="outline" className={`h-16 text-base font-bold ${scannedParticipant.status === 'checked_in' ? 'col-span-2' : ''}`} onClick={handleCollectPackage}>
                  <Package className="h-6 w-6 mr-2" /> Wydaj pakiet
                </Button>
              )}
              {scannedParticipant.status === 'checked_in' && scannedParticipant.package_status === 'collected' && (
                <p className="col-span-2 text-center text-sm text-primary font-medium py-4">✅ Wszystko gotowe!</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold mb-3">Ostatnio zeskanowani</p>
            <div className="space-y-2">
              {recentScans.map(p => {
                const current = participants.find(pp => pp.id === p.id) || p;
                return (
                  <div key={p.id} className="flex items-center justify-between py-1.5 text-sm cursor-pointer hover:bg-accent/30 px-2 rounded" onClick={() => { setScannedParticipant(current); setScanError(false); }}>
                    <span className="font-medium">{current.name} <span className="text-muted-foreground">#{current.bib_number}</span></span>
                    <Badge variant={current.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                      {current.status === 'checked_in' ? '✓' : '○'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
