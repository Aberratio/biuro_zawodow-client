import { useMemo, useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Info, Loader2, Mail, RefreshCcw, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function EmailSending() {
  const { participants, events, selectedEventId, sendEventQrEmails, sendParticipantQrEmail, isLoading } = useMockData();
  const [sendingAll, setSendingAll] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);
  const [sendingParticipantId, setSendingParticipantId] = useState<string | null>(null);
  const [lastErrors, setLastErrors] = useState<Array<{ participant_name: string; error: string }>>([]);

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === selectedEventId),
    [participants, selectedEventId]
  );
  const selectedEvent = events.find(event => event.id === selectedEventId);
  const sent = eventParticipants.filter(participant => participant.email_status === 'sent').length;
  const pending = eventParticipants.length - sent;

  if (isLoading) return <TableSkeleton rows={5} cols={4} subtitle="" />;

  const handleSendAll = async (resendAll: boolean) => {
    if (resendAll) {
      setResendingAll(true);
    } else {
      setSendingAll(true);
    }

    try {
      const result = await sendEventQrEmails(selectedEventId, resendAll);
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Wysyłka kodów QR</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {selectedEvent ? `Wydarzenie: ${selectedEvent.name}` : 'Wyślij kody QR dla wybranego wydarzenia.'}
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>„Wyślij brakujące” wyśle wiadomości tylko do uczestników bez statusu wysyłki.</p>
              <p>„Wyślij ponownie wszystkim” wymusi resend dla całego wydarzenia.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Status wysyłki</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{sent}/{eventParticipants.length}</div>
            <p className="text-sm text-muted-foreground mt-1">uczestników ma już mail z QR</p>
            <div className="h-2 bg-muted rounded-full mt-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${eventParticipants.length ? (sent / eventParticipants.length) * 100 : 0}%` }} />
            </div>
            <div className="grid gap-2 mt-4">
              <Button className="w-full h-11 sm:h-10" onClick={() => void handleSendAll(false)} disabled={sendingAll || pending === 0}>
                {sendingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                {pending === 0 ? 'Brak zaległych wiadomości' : `Wyślij brakujące (${pending})`}
              </Button>
              <Button variant="outline" className="w-full h-11 sm:h-10" onClick={() => void handleSendAll(true)} disabled={resendingAll || eventParticipants.length === 0}>
                {resendingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                Wyślij ponownie wszystkim
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
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{error.participant_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{error.error}</p>
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
        <CardContent className="overflow-x-auto -mx-6 px-6">
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
                  <TableCell className="font-medium text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{participant.name}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">{participant.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{participant.email}</TableCell>
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
                      disabled={sendingParticipantId === participant.id}
                      onClick={() => void handleSendOne(participant.id, participant.name)}
                    >
                      {sendingParticipantId === participant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Wyślij ponownie'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
