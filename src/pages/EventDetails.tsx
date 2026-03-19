import { useParams, useNavigate } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, Package, ScanLine, MapPin, Calendar, ArrowLeft } from 'lucide-react';

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { events, participants, setSelectedEventId } = useMockData();
  const event = events.find(e => e.id === id);
  const ep = participants.filter(p => p.event_id === id);
  const checkedIn = ep.filter(p => p.status === 'checked_in').length;
  const collected = ep.filter(p => p.package_status === 'collected').length;

  if (!event) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono wydarzenia</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/events')}><ArrowLeft className="h-4 w-4 mr-1" /> Wróć</Button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{event.date}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 pt-6"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold tabular-nums">{ep.length}</p><p className="text-xs text-muted-foreground">Uczestnicy</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 pt-6"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><CheckCircle className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold tabular-nums">{checkedIn}</p><p className="text-xs text-muted-foreground">Odprawieni</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 pt-6"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold tabular-nums">{collected}</p><p className="text-xs text-muted-foreground">Pakiety</p></div></CardContent></Card>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => { setSelectedEventId(event.id); navigate('/scanner'); }}><ScanLine className="h-4 w-4 mr-1" /> Otwórz skaner</Button>
        <Button variant="outline" onClick={() => { setSelectedEventId(event.id); navigate('/participants'); }}><Users className="h-4 w-4 mr-1" /> Uczestnicy</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Uczestnicy</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ep.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm border-b last:border-0 cursor-pointer hover:bg-accent/30 px-2 rounded" onClick={() => navigate(`/participants/${p.id}`)}>
                <div>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground ml-2">#{p.bib_number}</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant={p.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                    {p.status === 'checked_in' ? 'Odprawiony' : 'Oczekuje'}
                  </Badge>
                </div>
              </div>
            ))}
            {ep.length > 10 && <p className="text-xs text-muted-foreground text-center pt-2">...i {ep.length - 10} więcej</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
