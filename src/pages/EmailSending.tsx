import { useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Send, CheckCircle, Loader2, QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function EmailSending() {
  const { participants, selectedEventId, markEmailsSent } = useMockData();
  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);
  const sent = eventParticipants.filter(p => p.email_status === 'sent').length;
  const [sending, setSending] = useState(false);

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
      <h1 className="text-2xl font-bold tracking-tight">Wysyłka kodów QR</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Status wysyłki</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{sent}/{eventParticipants.length}</div>
            <p className="text-sm text-muted-foreground mt-1">kodów QR wysłanych</p>
            <div className="h-2 bg-muted rounded-full mt-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${eventParticipants.length ? (sent / eventParticipants.length) * 100 : 0}%` }} />
            </div>
            <Button className="w-full mt-4" onClick={handleSendAll} disabled={sending || sent === eventParticipants.length}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {sending ? 'Wysyłanie...' : sent === eventParticipants.length ? 'Wszystkie wysłane' : 'Wyślij do wszystkich'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Podgląd maila</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <p className="font-medium">Temat: Twój kod QR na wydarzenie</p>
              <hr />
              <p>Cześć <span className="font-semibold">[Imię]</span>,</p>
              <p>Oto Twój kod QR do odprawy na wydarzeniu. Pokaż go na stoisku rejestracyjnym.</p>
              <div className="flex items-center justify-center py-4">
                <div className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center">
                  <QrCode className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Numer startowy: <span className="font-semibold">[BIB]</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lista uczestników</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventParticipants.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
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
