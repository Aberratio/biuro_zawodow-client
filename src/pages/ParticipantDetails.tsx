import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, Loader2, Mail, QrCode, Repeat, Trash2, UserRoundCog } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DetailSkeleton from '@/components/skeletons/DetailSkeleton';
import type { ParticipantFieldMapping, ParticipantQrPreview, ParticipantStatus } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildParticipantFieldValues, getActiveParticipantMappings } from '@/lib/participant-fields';
import { getParticipantStatusDefinition, PARTICIPANT_STATUS_DEFINITIONS } from '@/lib/participant-status';
import { validateEmail, validateRequired } from '@/lib/form-validation';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';

function formatParticipantDateTime(value: string): string {
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
    second: '2-digit',
  }).format(parsed);
}

function getTimelineIcon(action: string) {
  const normalizedAction = action.toLocaleLowerCase('pl-PL');

  if (normalizedAction.includes('qr') || normalizedAction.includes('mail')) return Mail;
  if (normalizedAction.includes('przepis')) return Repeat;
  if (normalizedAction.includes('usun')) return Trash2;
  if (normalizedAction.includes('status') || normalizedAction.includes('check-in') || normalizedAction.includes('skan')) return CheckCircle;
  return Clock;
}

export default function ParticipantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    participants,
    events,
    activityLog,
    currentRole,
    updateParticipantStatus,
    reassignParticipantPackage,
    getParticipantFieldMappings,
    sendParticipantQrEmail,
    deleteParticipant,
    getParticipantQrPreview,
    isLoading,
    connectionState,
  } = useData();
  const participant = participants.find(entry => entry.id === id);
  const event = events.find(entry => entry.id === participant?.event_id);
  const [qrPreview, setQrPreview] = useState<ParticipantQrPreview | null>(null);
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [statusValue, setStatusValue] = useState<ParticipantStatus>('not_checked_in');
  const [transferOpen, setTransferOpen] = useState(false);
  const [sendQrConfirmOpen, setSendQrConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferFields, setTransferFields] = useState<Record<string, string>>({});
  const [transferErrors, setTransferErrors] = useState<{ email?: string; fields: Record<string, string>; form?: string }>({ fields: {} });
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSendingQr, setIsSendingQr] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [isDeletingParticipant, setIsDeletingParticipant] = useState(false);
  const canManageParticipantData = currentRole === 'editor' || currentRole === 'admin' || currentRole === 'superadmin' || currentRole === 'scanner_plus';
  const canUseAdminActions = currentRole === 'editor' || currentRole === 'admin' || currentRole === 'superadmin';
  const isOnline = connectionState === 'online';

  useEffect(() => {
    if (!participant) return;
    setStatusValue(participant.status);
    setTransferEmail(participant.email);
  }, [participant]);

  useEffect(() => {
    if (!participant?.event_id || !canManageParticipantData || !isOnline) return;

    void getParticipantFieldMappings(participant.event_id)
      .then(data => {
        setMappings(data);
        setTransferFields(buildParticipantFieldValues(data, participant));
      })
      .catch(() => {
        setMappings([]);
        setTransferFields({});
      });
  }, [canManageParticipantData, getParticipantFieldMappings, isOnline, participant]);

  useEffect(() => {
    if (!participant?.id || !canUseAdminActions || !isOnline) return;

    setIsQrLoading(true);
    void getParticipantQrPreview(participant.id)
      .then(setQrPreview)
      .catch(error => {
        toast({ title: 'Nie udaĹ‚o siÄ™ pobraÄ‡ podglÄ…du QR', description: error instanceof Error ? error.message : 'BĹ‚Ä…d API', variant: 'destructive' });
      })
      .finally(() => setIsQrLoading(false));
  }, [canUseAdminActions, getParticipantQrPreview, isOnline, participant?.id]);

  const activeMappings = useMemo(() => getActiveParticipantMappings(mappings), [mappings]);
  const timeline = useMemo(() => {
    if (!participant) return [];

    const participantApiId = participant.id.replace(/^p-/, '');
    const participantLogs = activityLog
      .filter(log => String(log.participant_id ?? '') === participantApiId)
      .map(log => ({
        time: formatParticipantDateTime(log.timestamp),
        desc: log.user_name ? `${log.action} (${log.user_name})` : log.action,
        icon: getTimelineIcon(log.action),
      }));

    if (participantLogs.length > 0) {
      return participantLogs;
    }

    const status = getParticipantStatusDefinition(participant.status);

    return [
      { time: 'Brak dokladnej daty', desc: 'Uczestnik znajduje sie na liscie startowej', icon: Clock },
      ...(participant.email_status === 'sent' ? [{ time: 'Brak dokladnej daty', desc: 'Kod QR zostal wyslany mailem', icon: Mail }] : []),
      ...(participant.checked_in_at ? [{ time: formatParticipantDateTime(participant.checked_in_at), desc: status.label, icon: CheckCircle }] : []),
    ];
  }, [activityLog, participant]);

  if (isLoading) return <DetailSkeleton />;
  if (!participant) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono uczestnika</div>;

  const statusDefinition = getParticipantStatusDefinition(participant.status);

  const handleSendQr = async () => {
    setSendQrConfirmOpen(false);
    setIsSendingQr(true);
    try {
      const result = await sendParticipantQrEmail(participant.id);
      if (!result.ok) {
        toast({ title: 'Nie udaĹ‚o siÄ™ wysĹ‚aÄ‡ maila', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Mail z QR wysĹ‚any', description: participant.name });
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
        toast({ title: 'Nie udaĹ‚o siÄ™ zmieniÄ‡ statusu', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Status uczestnika zaktualizowany' });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleTransferFieldChange = (alias: string, value: string) => {
    setTransferFields(previous => ({ ...previous, [alias]: value }));
    setTransferErrors(previous => ({ ...previous, fields: { ...previous.fields, [alias]: '' }, form: undefined }));
  };

  const handleTransferSubmit = async () => {
    const fieldErrors = activeMappings.reduce<Record<string, string>>((accumulator, mapping) => {
      if (mapping.field_role === 'bib_number') return accumulator;
      const error = validateRequired(transferFields[mapping.alias] ?? '', `UzupeĹ‚nij pole: ${mapping.alias}.`);
      if (error) accumulator[mapping.alias] = error;
      return accumulator;
    }, {});
    const nextErrors = {
      email: validateEmail(transferEmail),
      fields: fieldErrors,
    };

    if (nextErrors.email || Object.values(fieldErrors).some(Boolean)) {
      setTransferErrors(nextErrors);
      return;
    }

    setTransferErrors({ fields: {} });
    setIsSavingTransfer(true);
    try {
      const result = await reassignParticipantPackage(participant.id, transferEmail, transferFields);
      if (!result.ok) {
        setTransferErrors({ fields: {}, form: result.error ?? 'Nie udaĹ‚o siÄ™ przepisaÄ‡ pakietu.' });
        toast({ title: 'Nie udaĹ‚o siÄ™ przepisaÄ‡ pakietu', description: result.error, variant: 'destructive' });
        return;
      }

      setTransferOpen(false);
      setTransferErrors({ fields: {} });
      toast({ title: 'Pakiet przepisany na nowÄ… osobÄ™' });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const handleDeleteParticipant = async () => {
    setIsDeletingParticipant(true);
    const result = await deleteParticipant(participant.id);
    setIsDeletingParticipant(false);

    if (!result.ok) {
      toast({ title: 'Nie udaĹ‚o siÄ™ usunÄ…Ä‡ uczestnika', description: result.error, variant: 'destructive' });
      return;
    }

    setDeleteConfirmOpen(false);
    toast({ title: 'Uczestnik usuniÄ™ty' });
    navigate('/participants');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="touch-manipulation">
        <ArrowLeft className="h-4 w-4 mr-1" /> WrĂłÄ‡
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{participant.name}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{participant.email}</p>
          {event && <p className="text-xs text-muted-foreground mt-1">{event.name}</p>}
        </div>
        {canManageParticipantData && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setTransferOpen(true)} disabled={!isOnline}>
              <UserRoundCog className="h-4 w-4 mr-1" />
              Przepisz pakiet na innÄ… osobÄ™
            </Button>
            {canUseAdminActions && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setSendQrConfirmOpen(true)} disabled={isSendingQr || !isOnline}>
              {isSendingQr ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Repeat className="h-4 w-4 mr-1" />}
              WyĹ›lij ponownie QR
            </Button>
            )}
          </div>
        )}
      </div>

      {canUseAdminActions && (
        <div className="flex justify-end">
          <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => setDeleteConfirmOpen(true)} disabled={!isOnline}>
            <Trash2 className="h-4 w-4 mr-1" />
            UsuĹ„ uczestnika
          </Button>
        </div>
      )}

      {!isOnline && (
        <OnlineOnlyNotice description="Podglad QR, zmiana statusu poza skanerem, przepisanie pakietu, wysylka maila i usuwanie uczestnika wymagaja aktywnego polaczenia z serwerem." />
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">SzczegĂłĹ‚y uczestnika</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">Numer startowy</span><span className="font-semibold tabular-nums">#{participant.bib_number}</span></div>
                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">Status</span><Badge variant={statusDefinition.badgeVariant}>{statusDefinition.label}</Badge></div>
            {(participant.sync_state === 'pending_sync' || participant.sync_state === 'requires_review') && (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Synchronizacja</span>
                <Badge variant={participant.sync_state === 'pending_sync' ? 'secondary' : 'destructive'}>
                  {participant.sync_state === 'pending_sync' ? 'Oczekuje na synchronizacje' : 'Wymaga weryfikacji'}
                </Badge>
              </div>
            )}
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">Mail z QR</span><Badge variant={participant.email_status === 'sent' ? 'default' : 'secondary'}>{participant.email_status === 'sent' ? 'WysĹ‚any' : 'Oczekuje'}</Badge></div>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:justify-between"><span className="text-muted-foreground">Token QR</span><span className="font-mono text-xs break-all sm:max-w-[18rem] sm:text-right">{participant.qr_code}</span></div>
            {canManageParticipantData && (
              <div className="space-y-2 pt-2">
                <Label>ZmieĹ„ status</Label>
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
                  <Button className="w-full sm:w-auto" onClick={() => void handleSaveStatus()} disabled={isSavingStatus || statusValue === participant.status || !isOnline}>
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
          <CardHeader><CardTitle className="text-base">PodglÄ…d QR</CardTitle></CardHeader>
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
                <span className="text-sm">Brak podglÄ…du QR</span>
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

      <Dialog
        open={transferOpen}
        onOpenChange={nextOpen => {
          setTransferOpen(nextOpen);
          if (!nextOpen) setTransferErrors({ fields: {} });
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Przepisz pakiet na innÄ… osobÄ™</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label htmlFor="transfer-participant-email">Email</Label>
              <Input
                id="transfer-participant-email"
                type="email"
                value={transferEmail}
                onChange={event => {
                  setTransferEmail(event.target.value);
                  setTransferErrors(previous => ({ ...previous, email: undefined, form: undefined }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(transferErrors.email)}
                aria-describedby={transferErrors.email ? 'transfer-participant-email-error' : undefined}
              />
              <FieldError id="transfer-participant-email-error" className="mt-2">{transferErrors.email}</FieldError>
            </div>
            {activeMappings.map((mapping, index) => {
              const fieldId = `transfer-participant-field-${index}`;
              const errorId = `${fieldId}-error`;
              const fieldError = transferErrors.fields[mapping.alias];

              return (
                <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                  <Label htmlFor={fieldId}>{mapping.alias}</Label>
                  <Input
                    id={fieldId}
                    value={mapping.field_role === 'bib_number' ? participant.bib_number : (transferFields[mapping.alias] ?? '')}
                    onChange={event => handleTransferFieldChange(mapping.alias, event.target.value)}
                    className="mt-2"
                    readOnly={mapping.field_role === 'bib_number'}
                    required={mapping.field_role !== 'bib_number'}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? errorId : undefined}
                  />
                  <FieldError id={errorId} className="mt-2">{fieldError}</FieldError>
                </div>
              );
            })}
            <FieldError id="transfer-participant-form-error">{transferErrors.form}</FieldError>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button className="w-full sm:w-auto" onClick={() => void handleTransferSubmit()} disabled={isSavingTransfer}>
              {isSavingTransfer && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={sendQrConfirmOpen} onOpenChange={setSendQrConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>PotwierdĹş wysyĹ‚kÄ™ maila z kodem QR</AlertDialogTitle>
            <AlertDialogDescription>
              Do uczestnika <span className="font-medium text-foreground">{participant.name}</span> zostanie wysĹ‚any mail na adres <span className="font-medium text-foreground">{participant.email}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSendQr()} disabled={isSendingQr}>
              {isSendingQr && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              WyĹ›lij mail
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>UsunÄ…Ä‡ uczestnika?</AlertDialogTitle>
            <AlertDialogDescription>
              Uczestnik <span className="font-medium text-foreground">{participant.name}</span> zostanie trwale usuniÄ™ty z wydarzenia. Tej operacji nie da siÄ™ cofnÄ…Ä‡.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteParticipant()} disabled={isDeletingParticipant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingParticipant && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              UsuĹ„ uczestnika
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
