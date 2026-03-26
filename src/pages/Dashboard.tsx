import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Users, CalendarDays, CheckCircle, Package, Clock, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';

export default function Dashboard() {
  const { currentRole, visibleEvents, participants, activityLog, selectedEventId, isLoading } = useMockData();
  const navigate = useNavigate();

  if (isLoading) return <DashboardSkeleton />;

  const eventParticipants = participants.filter(p => p.event_id === selectedEventId);
  const checkedIn = eventParticipants.filter(p => p.status === 'checked_in').length;
  const collected = eventParticipants.filter(p => p.package_status === 'collected').length;
  const currentEvent = visibleEvents.find(e => e.id === selectedEventId);

  // Admin and Editor get the rich dashboard
  if (currentRole === 'admin' || currentRole === 'editor') {
    const scopedParticipants = participants.filter(p => visibleEvents.some(e => e.id === p.event_id));
    const totalParticipants = scopedParticipants.length;
    const totalCheckedIn = scopedParticipants.filter(p => p.status === 'checked_in').length;
    const totalCollected = scopedParticipants.filter(p => p.package_status === 'collected').length;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Przegląd {currentRole === 'admin' ? 'organizacji' : 'Twoich wydarzeń'} — statystyki i ostatnie akcje.
          </p>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
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
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all" onClick={() => navigate(`/events/${e.id}`)}>
                    <div className="min-w-0 mr-3">
                      <p className="font-medium text-sm truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.date} · {e.location}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{ci}/{ep.length}</p>
                      <div className="w-16 sm:w-20 h-1.5 bg-muted rounded-full mt-1">
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
              {activityLog.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Brak akcji do wyświetlenia</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Scanner view — single event focus
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Twój panel skanera — statystyki aktualnego wydarzenia.
        </p>
      </div>

      {currentEvent && (
        <Card className="border-2">
          <CardContent className="pt-6">
            <p className="text-base sm:text-lg font-semibold">{currentEvent.name}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{currentEvent.date} · {currentEvent.location}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick tips for scanner role */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Witaj! Kliknij <strong>„Przejdź do skanera"</strong> aby rozpocząć odprawę uczestników.</p>
              <p>Możesz skanować kody QR kamerą lub wyszukać zawodnika ręcznie po nazwisku/numerze.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <StatCard icon={Users} label="Uczestnicy" value={eventParticipants.length} />
        <StatCard icon={CheckCircle} label="Odprawieni" value={checkedIn} />
        <StatCard icon={Package} label="Pakiety" value={collected} />
      </div>
      <Button size="lg" className="w-full h-14 sm:h-16 text-base sm:text-lg gap-3 touch-manipulation active:scale-[0.98]" onClick={() => navigate('/scanner')}>
        <ScanLine className="h-5 w-5 sm:h-6 sm:w-6" /> Przejdź do skanera
      </Button>
      <Card>
        <CardHeader><CardTitle className="text-base">Ostatnie skany</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {activityLog.filter(l => l.action === 'Check-in').slice(0, 5).map(log => (
            <div key={log.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="font-medium truncate mr-2">{log.participant_name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: pl })}</span>
            </div>
          ))}
          {activityLog.filter(l => l.action === 'Check-in').length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Brak skanów — przejdź do skanera aby rozpocząć odprawę</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 pt-4 sm:pt-6 pb-4 sm:pb-6 px-2 sm:px-6">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        </div>
        <p className="text-lg sm:text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight">{label}</p>
      </CardContent>
    </Card>
  );
}
