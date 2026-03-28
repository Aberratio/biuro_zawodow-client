import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, Loader2, Mail, QrCode, Repeat, UserRoundCog } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import type { ParticipantFieldMapping, ParticipantQrPreview, ParticipantStatus } from '@/types';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { getParticipantStatusDefinition, PARTICIPANT_STATUS_DEFINITIONS } from '@/lib/participant-status';

export default function ParticipantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    participants,
    events,
    currentRole,
    updateParticipantStatus,
    reassignParticipantPackage,
    getParticipantFieldMappings,
    sendParticipantQrEmail,
    getParticipantQrPreview,
    isLoading,
  } = useMockData();
  const participant = participants.find(entry => entry.id === id);
  const event = events.find(entry => entry.id === participant?.event_id);
  const [qrPreview, setQrPreview] = useState<ParticipantQrPreview | null>(null);
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [statusValue, setStatusValue] = useState<ParticipantStatus>('not_checked_in');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferFields, setTransferFields] = useState<Record<string, string>>({});
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSendingQr, setIsSendingQr] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const canManage = currentRole === 'editor' || currentRole === 'admin' || currentRole === 'superadmin';

  useEffect(() => {
    if (!participant) return;
    setStatusValue(participant.status);
    setTransferEmail(participant.email);
  }, [participant]);

  useEffect(() => {
    if (!participant?.event_id || !canManage) return;

    void getParticipantFieldMappings(participant.event_id)
      .then(data => {
        setMappings(data);
        setTransferFields(buildParticipantFieldValues(data, participant));
      })
      .catch(() => {
        setMappings([]);
        setTransferFields({});
      });
  }, [canManage, getParticipantFieldMappings, participant]);

  useEffect(() => {
    if (!participant?.id || !canManage) return;

    setIsQrLoading(true);
    void getParticipantQrPreview(participant.id)
      .then(setQrPreview)
      .catch(error => {
        toast({ title: 'Nie udalo sie pobrac podgladu QR', description: error instanceof Error ? error.message : 'Blad API', variant: 'destructive' });
      })
      .finally(() => setIsQrLoading(false));
  }, [canManage, getParticipantQrPreview, participant?.id]);

  const activeMappings = useMemo(() => getActiveParticipantMappings(mappings), [mappings]);

  const timeline = useMemo(() => {
    if (!participant) return [];

    const status = getParticipantStatusDefinition(participant.status);

    return [
      { time: 'Rejestracja', desc: 'Uczestnik znajduje sie na liscie startowej', icon: Clock },
      ...(participant.email_status === 'sent' ? [{ time: 'QR wyslany', desc: 'Kod QR zostal wyslany mailem', icon: Mail }] : []),
      ...(participant.checked_in_at ? [{ time: 'Status', desc: `${status.label}${participant.checked_in_at ? ` o ${new Date(participant.checked_in_at).toLocaleTimeString('pl-PL')}` : ''}`, icon: CheckCircle }] : []),
    ];
  }, [participant]);

  if (isLoading) return <DetailSkeleton />;
  if (!participant) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono uczestnika</div>;

  const statusDefinition = getParticipantStatusDefinition(participant.status);

  const handleSendQr = async () => {
    setIsSendingQr(true);
    try {
      const result = await sendParticipantQrEmail(participant.id);
      if (!result.ok) {
        toast({ title: 'Nie udalo sie wyslac maila', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Mail z QR wyslany', description: participant.name });
    } finally {
      setIsSendingQr(false);
    }
  };

  const handleSaveStatus = async () => {
    if (statusValue === participant.status) return;

    setIsSavingStatus(true);
    try {
      const result = await updateParticipantStatus(participant.id, statusValue);
      if (!result.ok) {
        toast({ title: 'Nie udalo sie zmienic statusu', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Status uczestnika zaktualizowany' });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleTransferFieldChange = (alias: string, value: string) => {
    setTransferFields(previous => ({ ...previous, [alias]: value }));
  };

  const handleTransferSubmit = async () => {
    const missingFields = activeMappings
      .filter(mapping => (mapping.field_role !== 'bib_number') && !(transferFields[mapping.alias] ?? '').trim())
      .map(mapping => mapping.alias);

    if (!transferEmail.trim()) {
      toast({ title: 'Email jest wymagany', variant: 'destructive' });
      return;
    }

    if (missingFields.length > 0) {
      toast({ title: 'Uzupelnij wszystkie pola uczestnika', description: missingFields.join(', '), variant: 'destructive' });
      return;
    }

    setIsSavingTransfer(true);
    try {
      const result = await reassignParticipantPackage(participant.id, transferEmail, transferFields);
      if (!result.ok) {
        toast({ title: 'Nie udalo sie przepisac pakietu', description: result.error, variant: 'destructive' });
        return;
      }

      setTransferOpen(false);
      toast({ title: 'Pakiet przepisany na nowa osobe' });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="touch-manipulation">
        <ArrowLeft className="h-4 w-4 mr-1" /> Wroc
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{participant.name}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{participant.email}</p>
          {event && <p className="text-xs text-muted-foreground mt-1">{event.name}</p>}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <UserRoundCog className="h-4 w-4 mr-1" />
              Przepisz pakiet na inna osobe
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleSendQr()} disabled={isSendingQr}>
              {isSendingQr ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Repeat className="h-4 w-4 mr-1" />}
              Wyslij ponownie QR
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Szczegoly uczestnika</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Numer startowy</span><span className="font-semibold tabular-nums">#{participant.bib_number}</span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">Status</span><Badge variant={statusDefinition.badgeVariant}>{statusDefinition.label}</Badge></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">Mail z QR</span><Badge variant={participant.email_status === 'sent' ? 'default' : 'secondary'}>{participant.email_status === 'sent' ? 'Wyslany' : 'Oczekuje'}</Badge></div>
            <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Token QR</span><span className="font-mono text-xs break-all text-right">{participant.qr_code}</span></div>
            {canManage && (
              <div className="space-y-2 pt-2">
                <Label>Zmien status</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusValue} onValueChange={value => setStatusValue(value as ParticipantStatus)}>
                    <SelectTrigger className="sm:flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PARTICIPANT_STATUS_DEFINITIONS.map(status => (
                        <SelectItem key={status.code} value={status.code}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => void handleSaveStatus()} disabled={isSavingStatus || statusValue === participant.status}>
                    {isSavingStatus && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Zapisz status
                  </Button>
                </div>
                {statusValue === 'checked_in_not_starting' && (
                  <p className="text-xs text-muted-foreground">Pakiet odebrany, uczestnik nie wystartuje.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Podglad QR</CardTitle></CardHeader>
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
                <span className="text-sm">Brak podgladu QR</span>
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

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Przepisz pakiet na inna osobe</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={transferEmail} onChange={event => setTransferEmail(event.target.value)} className="mt-2" />
            </div>
            {activeMappings.map(mapping => (
              <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                <Label>{mapping.alias}</Label>
                <Input
                  value={mapping.field_role === 'bib_number' ? participant.bib_number : (transferFields[mapping.alias] ?? '')}
                  onChange={event => handleTransferFieldChange(mapping.alias, event.target.value)}
                  className="mt-2"
                  readOnly={mapping.field_role === 'bib_number'}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button onClick={() => void handleTransferSubmit()} disabled={isSavingTransfer}>
              {isSavingTransfer && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
