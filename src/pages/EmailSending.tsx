import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AlertTriangle, ArrowLeft, CheckCircle, Info, Loader2, Mail, RefreshCcw, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';
import { buildEventPath } from '@/lib/routes';

type PendingEmailAction =
  | { kind: 'send-missing'; count: number }
  | { kind: 'resend-all'; count: number }
  | { kind: 'send-one'; participantId: string; participantName: string; participantEmail: string };

export default function EmailSending() {
  const navigate = useNavigate();
  const { id: routeEventId = '' } = useParams<{ id: string }>();
  const {
    participants,
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
  const [lastErrors, setLastErrors] = useState<Array<{ participant_name: string; error: string }>>([]);
  const [pendingAction, setPendingAction] = useState<PendingEmailAction | null>(null);
  const activeEventId = routeEventId || selectedEventId;

  useRouteEventContext(routeEventId);

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === activeEventId),
    [activeEventId, participants],
  );
  const selectedEvent = events.find(event => event.id === activeEventId);
  const sent = eventParticipants.filter(participant => participant.email_status === 'sent').length;
  const pending = eventParticipants.length - sent;
  const hasSentEmails = sent > 0;
  const isConfirmingAction = sendingAll || resendingAll || sendingParticipantId !== null;
  const isOnline = connectionState === 'online';

  if (isLoading) {
    return <TableSkeleton rows={5} cols={4} subtitle="" />;
  }

  const handleSendAll = async (resendAll: boolean) => {
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

      setLastErrors(result.errors.map(error => ({ participant_name: error.participant_name, error: error.error })));
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
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(buildEventPath(activeEventId))} className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
          >
        <ArrowLeft className="h-4 w-4 mr-1" /> Wróć do wydarzenia
      </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl mt-8">Wysyłka kodów QR</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {selectedEvent ? `Wydarzenie: ${selectedEvent.name}` : 'Wyślij kody QR dla wybranego wydarzenia.'}
        </p>
      </div>

      {!isOnline && (
        <OnlineOnlyNotice description="Wysyłka i ponowne wysyłanie kodów QR wymagają aktywnego połączenia z serwerem. W trybie offline widoczny jest tylko stan z ostatniej synchronizacji." />
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>"Wyślij brakujące" wyśle wiadomości tylko do uczestników mających status wysyłki inny niż "Wysłano".</p>
              <p>{hasSentEmails ? '"Wyślij ponownie wszystkim" wymusi ponowną wysyłkę dla całego wydarzenia.' : '"Wyślij wszystkim" wyśle wiadomości do wszystkich uczestników wydarzenia.'}</p>
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
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${eventParticipants.length ? (sent / eventParticipants.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-4 grid gap-2">
              <Button className="h-11 w-full sm:h-10" onClick={() => setPendingAction({ kind: 'send-missing', count: pending })} disabled={sendingAll || pending === 0 || !isOnline || !activeEventId}>
                {sendingAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                {pending === 0 ? 'Brak zaległych wiadomości' : `Wyślij brakujące (${pending})`}
              </Button>
              <Button variant="outline" className="h-11 w-full sm:h-10" onClick={() => setPendingAction({ kind: 'resend-all', count: eventParticipants.length })} disabled={resendingAll || eventParticipants.length === 0 || !isOnline || !activeEventId}>
                {resendingAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1 h-4 w-4" />}
                {hasSentEmails ? 'Wyślij ponownie wszystkim' : 'Wyślij wszystkim'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ostatnie błędy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lastErrors.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Brak błędów z ostatniej operacji.
              </div>
            ) : (
              lastErrors.slice(0, 4).map(error => (
                <div key={`${error.participant_name}-${error.error}`} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-sm font-medium">{error.participant_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{error.error}</p>
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
                  ? <>{hasSentEmails
                    ? <>Ta operacja ponownie wyśle maile z kodem QR do <span className="font-medium text-foreground">{pendingAction.count}</span> uczestników wydarzenia.</>
                    : <>Ta operacja wyśle maile z kodem QR do <span className="font-medium text-foreground">{pendingAction.count}</span> uczestników wydarzenia.</>}</>
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
    </div>
  );
}
