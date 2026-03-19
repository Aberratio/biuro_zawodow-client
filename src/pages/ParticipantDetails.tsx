import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle, Package, Clock, Edit, Repeat } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ParticipantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { participants, currentRole, checkIn, collectPackage, updateParticipant } = useMockData();
  const participant = participants.find(p => p.id === id);
  const [editing, setEditing] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferName, setTransferName] = useState('');
  const [editForm, setEditForm] = useState({ name: '', email: '', bib_number: '' });
  const canEdit = currentRole === 'editor' || currentRole === 'admin';

  if (!participant) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono uczestnika</div>;

  const startEdit = () => {
    setEditForm({ name: participant.name, email: participant.email, bib_number: participant.bib_number });
    setEditing(true);
  };

  const saveEdit = () => {
    updateParticipant(participant.id, editForm);
    setEditing(false);
    toast({ title: 'Zapisano zmiany' });
  };

  const handleTransfer = () => {
    if (!transferName) return;
    toast({ title: 'Pakiet przepisany', description: `Pakiet przepisany na: ${transferName}` });
    setTransferOpen(false);
    setTransferName('');
  };

  const timeline = [
    { time: 'Rejestracja', desc: 'Zarejestrowany przez import CSV', icon: Clock },
    ...(participant.email_status === 'sent' ? [{ time: 'QR wysłany', desc: 'Kod QR wysłany na email', icon: Clock }] : []),
    ...(participant.status === 'checked_in' ? [{ time: 'Check-in', desc: `Odprawiony${participant.checked_in_at ? ` o ${new Date(participant.checked_in_at).toLocaleTimeString('pl')}` : ''}`, icon: CheckCircle }] : []),
    ...(participant.package_status === 'collected' ? [{ time: 'Pakiet', desc: 'Pakiet startowy wydany', icon: Package }] : []),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Wróć</Button>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{participant.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{participant.email}</p>
        </div>
        {canEdit && <Button variant="outline" size="sm" onClick={startEdit}><Edit className="h-3.5 w-3.5 mr-1" /> Edytuj</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Numer startowy</span><span className="font-semibold tabular-nums">#{participant.bib_number}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><Badge variant={participant.status === 'checked_in' ? 'default' : 'secondary'}>{participant.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}</Badge></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pakiet</span><Badge variant={participant.package_status === 'collected' ? 'default' : 'outline'}>{participant.package_status === 'collected' ? 'Wydany' : 'Nie wydany'}</Badge></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">QR Code</span><span className="font-mono text-xs">{participant.qr_code}</span></div>
          </CardContent>
        </Card>
        {canEdit && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Akcje</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {participant.status !== 'checked_in' && (
                <Button className="w-full" onClick={() => { checkIn(participant.id); toast({ title: 'Uczestnik odprawiony!' }); }}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Oznacz jako obecny
                </Button>
              )}
              {participant.package_status !== 'collected' && (
                <Button variant="outline" className="w-full" onClick={() => { collectPackage(participant.id); toast({ title: 'Pakiet wydany!' }); }}>
                  <Package className="h-4 w-4 mr-1" /> Wydaj pakiet
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setTransferOpen(true)}>
                <Repeat className="h-4 w-4 mr-1" /> Przepisz pakiet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historia</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <t.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t.time}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edytuj uczestnika</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Imię i nazwisko</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Numer startowy</Label><Input value={editForm.bib_number} onChange={e => setEditForm(f => ({ ...f, bib_number: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveEdit}>Zapisz</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Przepisz pakiet</DialogTitle></DialogHeader>
          <div><Label>Imię nowej osoby</Label><Input value={transferName} onChange={e => setTransferName(e.target.value)} placeholder="np. Jan Nowak" /></div>
          <DialogFooter><Button onClick={handleTransfer} disabled={!transferName}>Przepisz</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
