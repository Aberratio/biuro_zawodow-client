import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, Loader2, Mail, Package, Repeat, QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import type { ParticipantQrPreview } from '@/types';

export default function ParticipantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    participants,
    events,
    currentRole,
    checkIn,
    collectPackage,
    sendParticipantQrEmail,
    getParticipantQrPreview,
    isLoading,
  } = useMockData();
  const participant = participants.find(entry => entry.id === id);
  const event = events.find(entry => entry.id === participant?.event_id);
  const [qrPreview, setQrPreview] = useState<ParticipantQrPreview | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSendingQr, setIsSendingQr] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const canManage = currentRole === 'editor' || currentRole === 'admin' || currentRole === 'superadmin';

  useEffect(() => {
    if (!participant?.id || !canManage) return;

    setIsQrLoading(true);
    void getParticipantQrPreview(participant.id)
      .then(setQrPreview)
      .catch(error => {
        toast({ title: 'Nie udało się pobrać podglądu QR', description: error instanceof Error ? error.message : 'Błąd API', variant: 'destructive' });
      })
      .finally(() => setIsQrLoading(false));
  }, [canManage, getParticipantQrPreview, participant?.id]);

  const timeline = useMemo(() => {
    if (!participant) return [];

    return [
      { time: 'Rejestracja', desc: 'Uczestnik znajduje się na liście startowej', icon: Clock },
      ...(participant.email_status === 'sent' ? [{ time: 'QR wysłany', desc: 'Kod QR został wysłany mailem', icon: Mail }] : []),
      ...(participant.status === 'checked_in' ? [{ time: 'Check-in', desc: `Odprawiony${participant.checked_in_at ? ` o ${new Date(participant.checked_in_at).toLocaleTimeString('pl-PL')}` : ''}`, icon: CheckCircle }] : []),
      ...(participant.package_status === 'collected' ? [{ time: 'Pakiet', desc: 'Pakiet startowy został wydany', icon: Package }] : []),
    ];
  }, [participant]);

  if (isLoading) return <DetailSkeleton />;
  if (!participant) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono uczestnika</div>;

  const handleSendQr = async () => {
    setIsSendingQr(true);
    try {
      const result = await sendParticipantQrEmail(participant.id);
      if (!result.ok) {
        toast({ title: 'Nie udało się wysłać maila', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Mail z QR wysłany', description: participant.name });
    } finally {
      setIsSendingQr(false);
    }
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const result = await checkIn(participant.id);
      if (!result.ok) {
        toast({ title: 'Nie udało się odprawić uczestnika', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Uczestnik odprawiony' });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCollectPackage = async () => {
    setIsCollecting(true);
    try {
      const result = await collectPackage(participant.id);
      if (!result.ok) {
        toast({ title: 'Nie udało się wydać pakietu', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Pakiet wydany' });
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="touch-manipulation">
        <ArrowLeft className="h-4 w-4 mr-1" /> Wróć
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{participant.name}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{participant.email}</p>
          {event && <p className="text-xs text-muted-foreground mt-1">{event.name}</p>}
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => void handleSendQr()} disabled={isSendingQr} className="self-start">
            {isSendingQr ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Repeat className="h-4 w-4 mr-1" />}
            Wyślij ponownie QR
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Szczegóły uczestnika</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Numer startowy</span><span className="font-semibold tabular-nums">#{participant.bib_number}</span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">Status</span><Badge variant={participant.status === 'checked_in' ? 'default' : 'secondary'}>{participant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}</Badge></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">Pakiet</span><Badge variant={participant.package_status === 'collected' ? 'default' : 'outline'}>{participant.package_status === 'collected' ? 'Wydany' : 'Nie wydany'}</Badge></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">Mail z QR</span><Badge variant={participant.email_status === 'sent' ? 'default' : 'secondary'}>{participant.email_status === 'sent' ? 'Wysłany' : 'Oczekuje'}</Badge></div>
            <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Token QR</span><span className="font-mono text-xs break-all text-right">{participant.qr_code}</span></div>
            {canManage && (
              <div className="grid gap-2 pt-2">
                {participant.status !== 'checked_in' && (
                  <Button className="w-full" onClick={() => void handleCheckIn()} disabled={isCheckingIn}>
                    {isCheckingIn ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Oznacz jako obecny
                  </Button>
                )}
                {participant.package_status !== 'collected' && (
                  <Button variant="outline" className="w-full" onClick={() => void handleCollectPackage()} disabled={isCollecting}>
                    {isCollecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Package className="h-4 w-4 mr-1" />}
                    Wydaj pakiet
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Podgląd QR</CardTitle></CardHeader>
          <CardContent>
            {isQrLoading ? (
              <div className="aspect-square rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : qrPreview?.qr_code_svg_data_uri ? (
              <div className="space-y-3">
                <div className="rounded-2xl border bg-white p-4">
                  <img src={qrPreview.qr_code_svg_data_uri} alt={`Kod QR uczestnika ${participant.name}`} className="w-full h-auto" />
                </div>
                <div className="text-xs text-muted-foreground">
                  Ten kod jednoznacznie wskazuje uczestnika w wybranych zawodach.
                </div>
              </div>
            ) : (
              <div className="aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2">
                <QrCode className="h-8 w-8" />
                <span className="text-sm">Brak podglądu QR</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historia</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeline.map(entry => (
              <div key={`${entry.time}-${entry.desc}`} className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <entry.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{entry.time}</p>
                  <p className="text-xs text-muted-foreground">{entry.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
