import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, ShieldAlert, TimerReset } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMockData } from '@/contexts/MockDataContext';
import { formatEventOfficeStart, getEventOfficeOpenAt } from '@/lib/events';

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

export default function ScannerInfo() {
  const { currentRole, currentUser, events, visibleEvents } = useMockData();
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const upcomingAssignedEvents = useMemo(() => {
    if (currentRole !== 'scanner') return [];

    const now = new Date(nowTimestamp);
    return events
      .filter(event => currentUser.assigned_events.includes(event.id))
      .map(event => {
        const officeOpenAt = getEventOfficeOpenAt(event);
        return { event, officeOpenAt };
      })
      .filter((entry): entry is { event: typeof entry.event; officeOpenAt: Date } => entry.officeOpenAt !== null && entry.officeOpenAt > now)
      .sort((left, right) => left.officeOpenAt.getTime() - right.officeOpenAt.getTime());
  }, [currentRole, currentUser.assigned_events, events, nowTimestamp]);

  const nextUpcoming = upcomingAssignedEvents[0] ?? null;
  const millisecondsUntilNext = nextUpcoming ? nextUpcoming.officeOpenAt.getTime() - nowTimestamp : null;
  const showCountdown = millisecondsUntilNext !== null && millisecondsUntilNext > 0 && millisecondsUntilNext <= 3 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardContent className="px-6 py-10 sm:px-10 sm:py-12">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="mb-5 rounded-full bg-primary/10 p-4 text-primary">
              {showCountdown ? <TimerReset className="h-10 w-10" /> : <CalendarDays className="h-10 w-10" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Brak aktywnych zawodów</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Obecnie nie masz przypisanego żadnego wydarzenia z otwartym biurem zawodów, dlatego zakładki skanera i uczestników są chwilowo ukryte.
            </p>

            {showCountdown && nextUpcoming && millisecondsUntilNext !== null ? (
              <div className="mt-6 w-full rounded-3xl border border-primary/20 bg-primary/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Najbliższy start biura</p>
                <p className="mt-3 text-xl font-bold">{nextUpcoming.event.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">Otwarcie biura: {formatEventOfficeStart(nextUpcoming.event)}</p>
                <div className="mt-5 rounded-2xl bg-background px-5 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Start za</p>
                  <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-primary">{formatCountdown(millisecondsUntilNext)}</p>
                </div>
              </div>
            ) : nextUpcoming ? (
              <div className="mt-6 w-full rounded-3xl border border-primary/20 bg-primary/5 p-6 text-left">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Najbliższe przypisane zawody</p>
                    <p className="text-sm text-foreground">{nextUpcoming.event.name}</p>
                    <p className="text-sm text-muted-foreground">Biuro otwiera się {formatEventOfficeStart(nextUpcoming.event)}.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 w-full rounded-2xl border border-dashed bg-muted/30 p-4 text-left">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Co to oznacza?</p>
                  <p>Zobaczysz tu tylko te zawody, do których zostałeś przypisany bezpośrednio i dla których biuro zawodów jest teraz otwarte.</p>
                  <p>Jeśli powinieneś widzieć zawody, a ich tu nie ma, skonsultuj się koniecznie z administratorem. Możliwe, że nie zostałeś jeszcze przypisany do tych zawodów albo okno pracy biura nie zostało ustawione poprawnie.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {upcomingAssignedEvents.length > 0 && (
        <Card>
          <CardContent className="px-6 py-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Nadchodzące przypisania</h2>
                <p className="text-sm text-muted-foreground">Wydarzenia przypisane do Twojego konta, które jeszcze się nie otworzyły.</p>
              </div>
              <Badge variant="secondary">{upcomingAssignedEvents.length}</Badge>
            </div>
            <div className="mt-5 space-y-3">
              {upcomingAssignedEvents.map(({ event }, index) => (
                <div key={event.id} className="rounded-2xl border px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{event.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatEventOfficeStart(event)}</p>
                    </div>
                    {index === 0 && showCountdown ? (
                      <Badge variant="default">Najbliższe</Badge>
                    ) : (
                      <Badge variant="outline">Zaplanowane</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {currentRole === 'scanner' && visibleEvents.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="px-6 py-4 text-sm text-muted-foreground">
            Aktywne zawody są już dostępne. Możesz przejść do skanera lub uczestników z menu.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
