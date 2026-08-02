import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, ArrowLeft, CheckCircle, Copy, Info, Loader2, Mail, RefreshCcw, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';
import { PageHeader } from '@/components/PageHeader';
import { PageBlockerOverlay } from '@/components/PageBlockerOverlay';
import { formatEventOfficeWindow, isEventCurrentOrUpcoming, isEventOfficeOpen } from '@/lib/events';
import { buildEventPath } from '@/lib/routes';
import {
  QR_DELIVERY_STATUS_DEFINITIONS,
  getQrDeliveryStatusDefinition,
  normalizeQrDeliveryStatus,
  type QrDeliveryDisplayStatus,
} from '@/lib/qr-delivery-status';
import type { ActivityLog, Participant, QrEmailDelivery, QrEmailDeliveryReport } from '@/types';

type PendingEmailAction =
  | { kind: 'send-missing'; count: number }
  | { kind: 'resend-all'; count: number }
  | { kind: 'send-one'; participantId: string; participantName: string; participantEmail: string };

type PaymentScope = 'all' | 'paid_only';

const qrActionDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const refreshTimeFormatter = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

const DELIVERY_REFRESH_INTERVAL_MS = 30_000;

type DeliveryStatusFilter = 'all' | 'local_not_sent' | QrDeliveryDisplayStatus;

interface ParticipantDeliveryRow {
  participant: Participant;
  delivery: QrEmailDelivery | null;
  // null = brak danych z mailera dla tego wiersza -> pokazujemy lokalny stan wysyłki.
  displayStatus: QrDeliveryDisplayStatus | null;
}

// Mailer zwraca daty w formacie 'Y-m-d H:i:s'; Safari nie parsuje spacji w dacie.
const formatDeliveryTimestamp = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : qrActionDateFormatter.format(parsed);
};

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
    getEventQrEmailDeliveries,
    isLoading,
    connectionState,
  } = useData();
  const [sendingAll, setSendingAll] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);
  const [sendingParticipantId, setSendingParticipantId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingEmailAction | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<QrEmailDeliveryReport | null>(null);
  const [isRefreshingDeliveries, setIsRefreshingDeliveries] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [deliveriesUnavailable, setDeliveriesUnavailable] = useState(false);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>('all');
  const [deliverySearch, setDeliverySearch] = useState('');
  const activeEventId = routeEventId || selectedEventId;

  useRouteEventContext(routeEventId);

  const copyDeliveryError = useCallback(async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: 'Skopiowano treść błędu' });
    } catch {
      toast({ title: 'Nie udało się skopiować błędu', variant: 'destructive' });
    }
  }, []);

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
  const unpaidParticipantsCount = eventParticipants.filter(participant => participant.payment_status === 'unpaid').length;
  const paidParticipantsCount = eventParticipants.filter(participant => participant.payment_status === 'paid').length;
  const unknownPaymentCount = eventParticipants.filter(participant => participant.payment_status === 'unknown').length;
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

  const loadDeliveries = useCallback(async (silent: boolean) => {
    if (!activeEventId) return;
    if (!silent) setIsRefreshingDeliveries(true);
    try {
      const report = await getEventQrEmailDeliveries(activeEventId);
      setDeliveryReport(report);
      setLastRefreshedAt(new Date());
      setDeliveriesUnavailable(!report.mailer_available);
    } catch {
      // Polling nie może zasypywać użytkownika toastami — cicho przechodzimy na stan lokalny.
      setDeliveriesUnavailable(true);
      if (!silent) {
        toast({
          title: 'Nie udało się pobrać statusów dostarczenia',
          description: 'Pokazujemy lokalny stan wysyłki. Spróbuj odświeżyć za chwilę.',
          variant: 'destructive',
        });
      }
    } finally {
      if (!silent) setIsRefreshingDeliveries(false);
    }
  }, [activeEventId, getEventQrEmailDeliveries]);

  useEffect(() => {
    setDeliveryReport(null);
    setDeliveriesUnavailable(false);
    setLastRefreshedAt(null);
    if (!activeEventId || !isOnline) return;
    void loadDeliveries(true);
    const interval = window.setInterval(() => void loadDeliveries(true), DELIVERY_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeEventId, isOnline, loadDeliveries]);

  const deliveryDataAvailable = deliveryReport !== null && deliveryReport.mailer_available && !deliveriesUnavailable;
  const isTestModeReport = deliveryReport?.mailer_error === 'test_mode';

  const deliveryByParticipantId = useMemo(() => {
    const map = new Map<string, QrEmailDelivery>();
    for (const entry of deliveryReport?.participants ?? []) {
      if (entry.delivery) {
        // API zwraca liczbowe id uczestnika; UI używa prefiksu "p-".
        map.set(`p-${entry.participant_id}`, entry.delivery);
      }
    }
    return map;
  }, [deliveryReport]);

  const participantDeliveryRows = useMemo<ParticipantDeliveryRow[]>(
    () => eventParticipants.map(participant => {
      const delivery = deliveryByParticipantId.get(participant.id) ?? null;
      const displayStatus: QrDeliveryDisplayStatus | null = !deliveryDataAvailable
        ? null
        : delivery
          ? normalizeQrDeliveryStatus(delivery.effective_status)
          : participant.email_status === 'sent'
            ? 'no_data'
            : null;
      return { participant, delivery, displayStatus };
    }),
    [deliveryByParticipantId, deliveryDataAvailable, eventParticipants],
  );

  const filteredDeliveryRows = useMemo(() => {
    const search = deliverySearch.trim().toLowerCase();
    return participantDeliveryRows.filter(({ participant, displayStatus }) => {
      if (deliveryStatusFilter === 'local_not_sent') {
        if (!(displayStatus === null && participant.email_status !== 'sent')) return false;
      } else if (deliveryStatusFilter !== 'all' && displayStatus !== deliveryStatusFilter) {
        return false;
      }
      if (!search) return true;
      return [participant.name, participant.email, participant.bib_number]
        .some(value => String(value ?? '').toLowerCase().includes(search));
    });
  }, [deliverySearch, deliveryStatusFilter, participantDeliveryRows]);

  const deliverySummary = deliveryDataAvailable ? deliveryReport.summary : null;
  const allMailerDeliveriesSent = Boolean(
    deliverySummary
      && deliverySummary.participants_total > 0
      && deliverySummary.sent === deliverySummary.participants_total
      && deliverySummary.queued === 0
      && deliverySummary.failed === 0
      && deliverySummary.bounced === 0
      && deliverySummary.unknown === 0
      && deliverySummary.no_data === 0,
  );

  if (isLoading) {
    return <TableSkeleton rows={5} cols={4} subtitle="" />;
  }

  const handleSendAll = async (resendAll: boolean, paymentScope: PaymentScope) => {
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
      const result = await sendEventQrEmails(activeEventId, resendAll, paymentScope);
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
      void loadDeliveries(true);
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
      void loadDeliveries(true);
    }
  };

  const hasUnpaidOrUnknownInPendingAction = pendingAction?.kind !== 'send-one' && (unpaidParticipantsCount > 0 || unknownPaymentCount > 0);
  const unpaidInlineClause = pendingAction?.kind !== 'send-one' && unpaidParticipantsCount > 0
    ? <>, w tym <span className="font-medium text-amber-200">{unpaidParticipantsCount}</span> nieopłaconych</>
    : null;
  const confirmActionLabel = pendingAction && pendingAction.kind !== 'send-one' && unpaidParticipantsCount > 0
    ? `Wyślij do wszystkich (${pendingAction.count}, w tym ${unpaidParticipantsCount} nieopłaconych)`
    : 'Wyślij mail';

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

      {isOnline && !deliveryDataAvailable && deliveryReport !== null && (
        <Card className="border-amber-400/50 bg-amber-500/10">
          <CardContent className="py-3">
            <div className="flex items-start gap-2 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-muted-foreground">
                {isTestModeReport
                  ? 'Wydarzenie testowe — wysyłka jest symulowana, więc statusy dostarczenia nie są dostępne.'
                  : 'Statusy dostarczenia są chwilowo niedostępne — pokazujemy lokalny stan wysyłki.'}
              </p>
            </div>
          </CardContent>
        </Card>
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
            {deliverySummary && (
              <div className="mt-3 flex flex-wrap gap-1.5" data-testid="delivery-summary">
                <Badge variant="default" className="text-[10px]">Wysłane: {deliverySummary.sent}</Badge>
                <Badge variant="secondary" className="text-[10px]">W kolejce: {deliverySummary.queued}</Badge>
                {deliverySummary.bounced > 0 && (
                  <Badge variant="destructive" className="text-[10px]">Odbite: {deliverySummary.bounced}</Badge>
                )}
                {deliverySummary.failed > 0 && (
                  <Badge variant="destructive" className="text-[10px]">Błędy: {deliverySummary.failed}</Badge>
                )}
                {deliverySummary.unknown > 0 && (
                  <Badge variant="outline" className="text-[10px]">Nieznane: {deliverySummary.unknown}</Badge>
                )}
                {deliverySummary.no_data > 0 && (
                  <Badge variant="outline" className="text-[10px]">Brak danych: {deliverySummary.no_data}</Badge>
                )}
              </div>
            )}
            {allMailerDeliveriesSent && (
              <div
                className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900"
                data-testid="all-mailer-deliveries-sent"
              >
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Serwer pocztowy potwierdził wysłanie wszystkich maili z kodami QR.</span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void loadDeliveries(false)}
                disabled={!isOnline || isRefreshingDeliveries || !activeEventId}
              >
                {isRefreshingDeliveries
                  ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  : <RefreshCcw className="mr-1 h-3.5 w-3.5" />}
                Odśwież statusy
              </Button>
              {lastRefreshedAt && (
                <span className="text-xs text-muted-foreground">
                  Aktualizacja: {refreshTimeFormatter.format(lastRefreshedAt)}
                </span>
              )}
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Szukaj po imieniu, email lub numerze..."
              value={deliverySearch}
              onChange={event => setDeliverySearch(event.target.value)}
              className="sm:max-w-xs"
            />
            <Select
              value={deliveryStatusFilter}
              onValueChange={value => setDeliveryStatusFilter(value as DeliveryStatusFilter)}
              disabled={!deliveryDataAvailable}
            >
              <SelectTrigger className="sm:w-64" aria-label="Filtr statusu dostarczenia">
                <SelectValue placeholder="Wszystkie statusy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                <SelectItem value="local_not_sent">Oczekuje (nie wysłano)</SelectItem>
                {QR_DELIVERY_STATUS_DEFINITIONS.map(definition => (
                  <SelectItem key={definition.code} value={definition.code}>{definition.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Wysłano</TableHead>
                <TableHead className="text-right">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveryRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Brak uczestników pasujących do filtrów.
                  </TableCell>
                </TableRow>
              )}
              {filteredDeliveryRows.map(({ participant, delivery, displayStatus }) => {
                const statusDefinition = displayStatus !== null ? getQrDeliveryStatusDefinition(displayStatus) : null;
                const showError = delivery?.last_error
                  && (displayStatus === 'failed' || displayStatus === 'bounced' || displayStatus === 'suppressed' || displayStatus === 'retry');
                return (
                  <TableRow key={participant.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="min-w-0">
                        <p className="truncate">{participant.name}</p>
                        <p className="truncate text-xs text-muted-foreground md:hidden">{participant.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{participant.email}</TableCell>
                    <TableCell>
                      <div className="flex min-h-9 flex-col justify-center gap-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {statusDefinition ? (
                            <Badge variant={statusDefinition.badgeVariant} className="gap-1 text-[10px]">
                              {displayStatus === 'sent' && <CheckCircle className="h-3 w-3" />}
                              {statusDefinition.shortLabel}
                            </Badge>
                          ) : (
                            <Badge variant={participant.email_status === 'sent' ? 'default' : 'secondary'} className="gap-1 text-[10px]">
                              {participant.email_status === 'sent'
                                ? <><CheckCircle className="h-3 w-3" /> Wysłany</>
                                : <><Mail className="h-3 w-3" /> Oczekuje</>}
                            </Badge>
                          )}
                          {delivery && (
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              title={delivery.is_batch ? `Wysyłka masowa (batch: ${delivery.batch_id ?? ''})` : 'Wysyłka pojedyncza'}
                            >
                              {delivery.is_batch ? 'Masowa' : 'Pojedyncza'}
                              {delivery.send_count > 1 ? ` ×${delivery.send_count}` : ''}
                            </Badge>
                          )}
                        </div>
                        {showError && delivery?.last_error && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 w-fit gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                <AlertCircle className="h-3 w-3" />
                                Szczegóły błędu
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-80 space-y-2">
                              <p className="text-sm font-medium">Treść błędu wysyłki</p>
                              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                {delivery.last_error}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => copyDeliveryError(delivery.last_error ?? '')}
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" />
                                Kopiuj
                              </Button>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {formatDeliveryTimestamp(delivery?.sent_at)}
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
                );
              })}
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
                  ? <>Ta operacja ponownie wyśle maile z kodem QR do <span className="font-medium text-foreground">{pendingAction.count}</span> uczestników wydarzenia{unpaidInlineClause}.</>
                  : hasNoSentEmails
                    ? <>Ta operacja wyśle maile z kodem QR do <span className="font-medium text-foreground">{pendingAction?.count ?? 0}</span> uczestników wydarzenia{unpaidInlineClause}.</>
                    : <>Ta operacja wyśle brakujące maile z kodem QR do <span className="font-medium text-foreground">{pendingAction?.count ?? 0}</span> uczestników wydarzenia{unpaidInlineClause}.</>}
            </AlertDialogDescription>
            {hasUnpaidOrUnknownInPendingAction && (
              <div className="rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                Nieopłaconych: {unpaidParticipantsCount}. Nieznany status opłaty: {unknownPaymentCount}.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2 sm:space-x-0">
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            {pendingAction && pendingAction.kind !== 'send-one' && (
              <Button
                variant="outline"
                onClick={() => {
                  void handleSendAll(pendingAction.kind === 'resend-all', 'paid_only');
                }}
                disabled={isConfirmingAction || !isOnline || paidParticipantsCount === 0}
              >
                Tylko opłaceni ({paidParticipantsCount})
              </Button>
            )}
            <AlertDialogAction
              onClick={() => {
                if (!pendingAction) {
                  return;
                }

                if (pendingAction.kind === 'send-one') {
                  void handleSendOne(pendingAction.participantId, pendingAction.participantName);
                  return;
                }

                void handleSendAll(pendingAction.kind === 'resend-all', 'all');
              }}
              disabled={isConfirmingAction || !isOnline}
            >
              {isConfirmingAction && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {confirmActionLabel}
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
