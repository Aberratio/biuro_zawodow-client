import { useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Send, CheckCircle, Loader2, QrCode, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function EmailSending() {
  const { participants, selectedEventId, markEmailsSent, isLoading } = useMockData();
  const [sending, setSending] = useState(false);

  if (isLoading) return <TableSkeleton rows={5} cols={3} subtitle="" />;

  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);
  const sent = eventParticipants.filter(p => p.email_status === 'sent').length;

  const handleSendAll = () => {
    setSending(true);
    setTimeout(() => {
      markEmailsSent(selectedEventId);
      setSending(false);
      toast({ title: 'Kody QR wysłane!', description: `Wysłano do ${eventParticipants.length} uczestników` });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Wysyłka kodów QR</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Wyślij kody QR do uczestników wybranego wydarzenia. Każdy uczestnik otrzyma unikalny kod na email.
        </p>
      </div>

      {/* Instructions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Kliknij <strong>„Wyślij do wszystkich"</strong> aby wysłać kody QR do wszystkich uczestników, którzy jeszcze ich nie otrzymali.</p>
              <p>Uczestnicy użyją kodów QR do szybkiej odprawy na miejscu wydarzenia.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Status wysyłki</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{sent}/{eventParticipants.length}</div>
            <p className="text-sm text-muted-foreground mt-1">kodów QR wysłanych</p>
            <div className="h-2 bg-muted rounded-full mt-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${eventParticipants.length ? (sent / eventParticipants.length) * 100 : 0}%` }} />
            </div>
            <Button className="w-full mt-4 h-11 sm:h-10" onClick={handleSendAll} disabled={sending || sent === eventParticipants.length}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {sending ? 'Wysyłanie...' : sent === eventParticipants.length ? 'Wszystkie wysłane' : 'Wyślij do wszystkich'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Podgląd maila</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border p-3 sm:p-4 space-y-3 text-sm">
              <p className="font-medium">Temat: Twój kod QR na wydarzenie</p>
              <hr />
              <p>Cześć <span className="font-semibold">[Imię]</span>,</p>
              <p className="text-xs sm:text-sm">Oto Twój kod QR do odprawy na wydarzeniu. Pokaż go na stoisku rejestracyjnym.</p>
              <div className="flex items-center justify-center py-3 sm:py-4">
                <div className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-dashed rounded-lg flex items-center justify-center">
                  <QrCode className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Numer startowy: <span className="font-semibold">[BIB]</span></p>
            </div>
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
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventParticipants.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.email_status === 'sent' ? 'default' : 'secondary'} className="gap-1 text-[10px]">
                      {p.email_status === 'sent' ? <><CheckCircle className="h-3 w-3" /> Wysłany</> : <><Mail className="h-3 w-3" /> Oczekuje</>}
                    </Badge>
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
