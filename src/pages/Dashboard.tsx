import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Users, CalendarDays, CheckCircle, Package, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function Dashboard() {
  const { currentRole, visibleEvents, participants, activityLog, selectedEventId } = useMockData();
  const navigate = useNavigate();
  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);
  const checkedIn = eventParticipants.filter(p => p.status === 'checked_in').length;
  const collected = eventParticipants.filter(p => p.package_status === 'collected').length;
  const currentEvent = visibleEvents.find(e => e.id === selectedEventId);

  // Admin and Editor get the rich dashboard (editor scoped to their events)
  if (currentRole === 'admin' || currentRole === 'editor') {
    const scopedParticipants = participants.filter(p => visibleEvents.some(e => e.id === p.event_id));
    const totalParticipants = scopedParticipants.length;
    const totalCheckedIn = scopedParticipants.filter(p => p.status === 'checked_in').length;
    const totalCollected = scopedParticipants.filter(p => p.package_status === 'collected').length;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={CalendarDays} label="Wydarzenia" value={visibleEvents.length} />
          <StatCard icon={Users} label="Uczestnicy" value={totalParticipants} />
          <StatCard icon={CheckCircle} label="Odprawieni" value={totalCheckedIn} />
          <StatCard icon={Package} label="Pakiety wydane" value={totalCollected} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Wydarzenia</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {visibleEvents.map(e => {
                const ep = participants.filter(p => p.event_id === e.id);
                const ci = ep.filter(p => p.status === 'checked_in').length;
                return (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/events/${e.id}`)}>
                    <div>
                      <p className="font-medium text-sm">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.date} · {e.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{ci}/{ep.length}</p>
                      <div className="w-20 h-1.5 bg-muted rounded-full mt-1">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${ep.length ? (ci / ep.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Ostatnie akcje</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {activityLog.slice(0, 8).map(log => (
                <div key={log.id} className="flex items-start gap-3 text-sm py-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium">{log.action}</span>
                    {log.participant_name && <span className="text-muted-foreground"> — {log.participant_name}</span>}
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: pl })}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Scanner view — single event focus
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      {currentEvent && (
        <Card className="border-2">
          <CardContent className="pt-6">
            <p className="text-lg font-semibold">{currentEvent.name}</p>
            <p className="text-sm text-muted-foreground">{currentEvent.date} · {currentEvent.location}</p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Uczestnicy" value={eventParticipants.length} />
        <StatCard icon={CheckCircle} label="Odprawieni" value={checkedIn} />
        <StatCard icon={Package} label="Pakiety" value={collected} />
      </div>
      <Button size="lg" className="w-full h-16 text-lg gap-3" onClick={() => navigate('/scanner')}>
        <ScanLine className="h-6 w-6" /> Przejdź do skanera
      </Button>
      <Card>
        <CardHeader><CardTitle className="text-base">Ostatnie skany</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {activityLog.filter(l => l.action === 'Check-in').slice(0, 5).map(log => (
            <div key={log.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="font-medium">{log.participant_name}</span>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: pl })}</span>
            </div>
          ))}
          {activityLog.filter(l => l.action === 'Check-in').length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Brak skanów</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
