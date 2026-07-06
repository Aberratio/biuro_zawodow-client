import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CheckCircle, Info, Loader2, Mail, RefreshCcw, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';
import { PageHeader } from '@/components/PageHeader';
import { PageBlockerOverlay } from '@/components/PageBlockerOverlay';
import { formatEventOfficeWindow, isEventCurrentOrUpcoming, isEventOfficeOpen } from '@/lib/events';
import { buildEventPath } from '@/lib/routes';
import type { ActivityLog, Participant } from '@/types';

type PendingEmailAction =
  | { kind: 'send-missing'; count: number }
  | { kind: 'resend-all'; count: number }
  | { kind: 'send-one'; participantId: string; participantName: string; participantEmail: string };

const qrActionDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const isQrSendingActivity = (action: string) => {
  const normalizedAction = action.toLowerCase();
  return normalizedAction.includes('kod qr') || normalizedAction.includes('kody qr') || normalizedAction.includes('kodu qr');
};

const formatQrActivityAction = (log: ActivityLog) => {
  const normalizedAction = log.action.toLowerCase();

  if (normalizedAction === 'ponownie wyslano kod qr') {
    return `Wysłano ponownie kod QR do ${log.participant_name ?? 'uczestnika'}.`;
  }

  if (normalizedAction === 'wysłano ponownie kod qr') {
    return `Wysłano ponownie kod QR do ${log.participant_name ?? 'uczestnika'}.`;
  }

  if (normalizedAction === 'wysłano kod qr') {
    return `Wysłano kod QR do ${log.participant_name ?? 'uczestnika'}.`;
  }

  if (normalizedAction === 'nie udało się wysłać kodu qr' || normalizedAction.startsWith('nie udało się wysłać kodu qr:')) {
    return log.participant_name
      ? `Nie udało się wysłać kodu QR do ${log.participant_name}.`
      : 'Nie udało się wysłać kodu QR.';
  }

  if (normalizedAction === 'nie udało się ponownie wysłać kodu qr' || normalizedAction.startsWith('nie udało się ponownie wysłać kodu qr:')) {
    return log.participant_name
      ? `Nie udało się ponownie wysłać kodu QR do ${log.participant_name}.`
      : 'Nie udało się ponownie wysłać kodu QR.';
  }

  return log.participant_name && normalizedAction.includes('kod qr') && !normalizedAction.includes(log.participant_name.toLowerCase())
    ? `${log.action} ${log.participant_name}.`
    : log.action;
};

const compareParticipantsByStableListOrder = (first: Participant, second: Participant) =>
  first.id.localeCompare(second.id, 'pl', { numeric: true, sensitivity: 'base' });

export default function EmailSending() {
  const navigate = useNavigate();
  const { id: routeEventId = '' } = useParams<{ id: string }>();
  const {
    participants,
    activityLog,
    events,
    selectedEventId,
    sendEventQrEmails,
    sendParticipantQrEmail,
    isLoading,
    connectionState,
  } = useData();
  const [sendingAll, setSendingAll] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);
  const [sendingParticipantId, setSendingParticipantId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingEmailAction | null>(null);
  const activeEventId = routeEventId || selectedEventId;

  useRouteEventContext(routeEventId);

  const eventParticipants = useMemo(
    () => participants
      .filter(participant => participant.event_id === activeEventId)
      .sort(compareParticipantsByStableListOrder),
    [activeEventId, participants],
  );
  const selectedEvent = events.find(event => event.id === activeEventId);
  const isOfficeOpenNow = selectedEvent ? isEventOfficeOpen(selectedEvent) : false;
  const canSendBulkQrEmails = selectedEvent ? isEventCurrentOrUpcoming(selectedEvent) : false;
  const sent = eventParticipants.filter(participant => participant.email_status === 'sent').length;
  const pending = eventParticipants.length - sent;
  const hasParticipants = eventParticipants.length > 0;
  const hasSentEmails = sent > 0;
  const hasPendingEmails = pending > 0;
  const hasNoSentEmails = sent === 0;
  const hasPartialDelivery = hasSentEmails && hasPendingEmails;
  const recentQrActions = useMemo(
    () => activityLog
      .filter(log => log.event_id === activeEventId && isQrSendingActivity(log.action))
      .slice(0, 5),
    [activeEventId, activityLog],
  );
  const isConfirmingAction = sendingAll || resendingAll || sendingParticipantId !== null;
  const isSendingQrEmails = sendingAll || resendingAll || sendingParticipantId !== null;
  const isOnline = connectionState === 'online';

  if (isLoading) {
    return <TableSkeleton rows={5} cols={4} subtitle="" />;
  }

  const handleSendAll = async (resendAll: boolean) => {
    if (resendAll && isOfficeOpenNow) {
      setPendingAction(null);
      toast({
        title: 'Ponowna wysyłka zablokowana',
        description: 'W godzinach działania biura można wysyłać tylko brakujące kody QR.',
        variant: 'destructive',
      });
      return;
    }

    setPendingAction(null);
    if (resendAll) {
      setResendingAll(true);
    } else {
      setSendingAll(true);
    }

    try {
      const result = await sendEventQrEmails(activeEventId, resendAll);
      if (!result.ok) {
        toast({ title: 'Nie udało się wysłać kodów QR', description: result.error, variant: 'destructive' });
        return;
      }

      if (result.error_count > 0) {
        toast({
          title: 'Wysyłka zakończona częściowo',
          description: `Wysłano ${result.sent_count}, błędów: ${result.error_count}.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: resendAll ? 'Ponownie wysłano kody QR' : 'Wysłano kody QR',
        description: `Łącznie wysłano ${result.sent_count} wiadomości.`,
      });
    } finally {
      setSendingAll(false);
      setResendingAll(false);
    }
  };

  const handleSendOne = async (participantId: string, participantName: string) => {
    setPendingAction(null);
    setSendingParticipantId(participantId);
    try {
      const result = await sendParticipantQrEmail(participantId);
      if (!result.ok) {
        toast({ title: 'Nie udało się wysłać maila', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Mail wysłany', description: participantName });
    } finally {
      setSendingParticipantId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(buildEventPath(activeEventId))} className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
          >
        <ArrowLeft className="h-4 w-4 mr-1" /> Wróć do wydarzenia
      </Button>
        <PageHeader
          title="Wysyłka kodów QR"
          description={
            selectedEvent
              ? `Wydarzenie: ${selectedEvent.name}`
              : "Wyślij kody QR dla wybranego wydarzenia."
          }
        />
      </div>

      {!isOnline && (
        <OnlineOnlyNotice description="Wysyłka i ponowne wysyłanie kodów QR wymagają aktywnego połączenia z serwerem. W trybie offline widoczny jest tylko stan z ostatniej synchronizacji." />
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1 text-xs text-muted-foreground">
              {!canSendBulkQrEmails ? (
                <p>Po zamknięciu biura zawodów masowa wysyłka kodów QR jest niedostępna.</p>
              ) : hasNoSentEmails ? (
                <p>"Wyślij kody QR do wszystkich uczestników" wyśle wiadomość email z kodami qr do wszystkich uczestników na aktualnej liście.</p>
              ) : (
                <>
                  {!isOfficeOpenNow && (
                    <p>"Wyślij ponownie kody QR do wszystkich uczestników" wymusi ponowną wysyłkę dla całego wydarzenia.</p>
                  )}
                  {hasPartialDelivery && (
                    <p>"Wyślij brakujące kody QR" wyśle wiadomości tylko do uczestników, którzy nie dostali jeszcze maila z kodem QR.</p>
                  )}
                  {isOfficeOpenNow && (
                    <p>W godzinach działania biura ponowna wysyłka do wszystkich jest zablokowana, ale nadal możesz wysłać brakujące kody QR.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Status wysyłki</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{sent}/{eventParticipants.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">uczestników ma już mail z QR</p>
            {selectedEvent && (
              <p className="mt-2 text-xs text-muted-foreground">Biuro: {formatEventOfficeWindow(selectedEvent)}</p>
            )}
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${eventParticipants.length ? (sent / eventParticipants.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-4 grid gap-2">
              {hasNoSentEmails ? (
                <Button className="h-11 w-full sm:h-10" onClick={() => setPendingAction({ kind: 'send-missing', count: pending })} disabled={sendingAll || !hasParticipants || !isOnline || !activeEventId || !canSendBulkQrEmails}>
                  {sendingAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                  Wyślij kody QR do wszystkich uczestników
                </Button>
              ) : (
                <>
                  {!isOfficeOpenNow && (
                    <Button variant="outline" className="h-11 w-full sm:h-10" onClick={() => setPendingAction({ kind: 'resend-all', count: eventParticipants.length })} disabled={resendingAll || !hasParticipants || !isOnline || !activeEventId || !canSendBulkQrEmails}>
                      {resendingAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1 h-4 w-4" />}
                      Wyślij ponownie kody QR do wszystkich uczestników
                    </Button>
                  )}
                  {hasPartialDelivery && (
                    <Button className="h-11 w-full sm:h-10" onClick={() => setPendingAction({ kind: 'send-missing', count: pending })} disabled={sendingAll || !hasPendingEmails || !isOnline || !activeEventId || !canSendBulkQrEmails}>
                      {sendingAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                      Wyślij brakujące kody QR
                    </Button>
                  )}
                </>
              )}
              {!canSendBulkQrEmails && (
                <p className="text-sm text-muted-foreground">
                  To wydarzenie ma już zamknięte biuro zawodów, więc masowa wysyłka została wyłączona.
                </p>
              )}
              {canSendBulkQrEmails && isOfficeOpenNow && !hasPartialDelivery && !hasNoSentEmails && (
                <p className="text-sm text-muted-foreground">
                  W godzinach działania biura nie można ponownie wysłać kodów QR do wszystkich uczestników.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ostatnie akcje</CardTitle>
            <CardDescription>
              Historia ostatnich operacji wysyłki kodów QR (5 ostatnich, resztę możesz eksportować w zakładce ze szczególami tego wydarzenia).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentQrActions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Brak zapisanych akcji wysyłki kodów QR dla tego wydarzenia.
              </div>
            ) : (
              recentQrActions.map(log => (
                <div key={log.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium leading-5">{formatQrActivityAction(log)}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{qrActionDateFormatter.format(new Date(log.timestamp))}</span>
                      <span>{log.user_name ? `Wysłał(a): ${log.user_name}` : 'Operator nieznany'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lista uczestników</CardTitle></CardHeader>
        <CardContent className="-mx-6 overflow-x-auto px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventParticipants.map(participant => (
                <TableRow key={participant.id}>
                  <TableCell className="text-sm font-medium">
                    <div className="min-w-0">
                      <p className="truncate">{participant.name}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">{participant.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{participant.email}</TableCell>
                  <TableCell>
                    <Badge variant={participant.email_status === 'sent' ? 'default' : 'secondary'} className="gap-1 text-[10px]">
                      {participant.email_status === 'sent'
                        ? <><CheckCircle className="h-3 w-3" /> Wysłany</>
                        : <><Mail className="h-3 w-3" /> Oczekuje</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-full sm:w-auto"
                      disabled={sendingParticipantId === participant.id || !isOnline}
                      onClick={() => setPendingAction({
                        kind: 'send-one',
                        participantId: participant.id,
                        participantName: participant.name,
                        participantEmail: participant.email,
                      })}
                    >
                      {sendingParticipantId === participant.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : participant.email_status === 'sent'
                          ? 'Wyślij ponownie'
                          : 'Wyślij'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={pendingAction !== null} onOpenChange={open => !open && setPendingAction(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź wysyłkę maili z kodem QR</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === 'send-one'
                ? <>Do uczestnika <span className="font-medium text-foreground">{pendingAction.participantName}</span> zostanie wysłany mail na adres <span className="font-medium text-foreground">{pendingAction.participantEmail}</span>.</>
                : pendingAction?.kind === 'resend-all'
                  ? <>Ta operacja ponownie wyśle maile z kodem QR do <span className="font-medium text-foreground">{pendingAction.count}</span> uczestników wydarzenia.</>
                  : hasNoSentEmails
                    ? <>Ta operacja wyśle maile z kodem QR do <span className="font-medium text-foreground">{pendingAction?.count ?? 0}</span> uczestników wydarzenia.</>
                    : <>Ta operacja wyśle brakujące maile z kodem QR do <span className="font-medium text-foreground">{pendingAction?.count ?? 0}</span> uczestników wydarzenia.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingAction) {
                  return;
                }

                if (pendingAction.kind === 'send-one') {
                  void handleSendOne(pendingAction.participantId, pendingAction.participantName);
                  return;
                }

                void handleSendAll(pendingAction.kind === 'resend-all');
              }}
              disabled={isConfirmingAction || !isOnline}
            >
              {isConfirmingAction && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Wyślij mail
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isSendingQrEmails && (
        <PageBlockerOverlay
          title="Wysyłamy kody QR"
          description="To może chwilę potrwać. Strona jest na ten czas zablokowana, więc spokojnie możesz zrobić sobie kawę."
        />
      )}
    </div>
  );
}
