import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowLeft } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { formatEventOfficeWindow, getEventOfficeOpenAt } from "@/lib/events";
import { participantCountsAsCheckedIn } from "@/lib/participant-status";

export default function ArchivedEvents() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { archivedEvents, organizations, participants, isLoading } = useData();

  const organization = useMemo(
    () => organizations.find((entry) => entry.id === id),
    [id, organizations],
  );

  const participantStatsByEventId = useMemo(() => {
    return participants.reduce<
      Record<string, { participantCount: number; checkedInCount: number }>
    >((accumulator, participant) => {
      const current = accumulator[participant.event_id] ?? {
        participantCount: 0,
        checkedInCount: 0,
      };
      current.participantCount += 1;
      if (participantCountsAsCheckedIn(participant)) {
        current.checkedInCount += 1;
      }
      accumulator[participant.event_id] = current;
      return accumulator;
    }, {});
  }, [participants]);

  const eventRows = useMemo(() => {
    return archivedEvents
      .filter((event) => event.organization_id === id)
      .map((event) => {
        const participantStats = participantStatsByEventId[event.id] ?? {
          participantCount: 0,
          checkedInCount: 0,
        };

        return {
          ...event,
          checkedInCount: participantStats.checkedInCount,
          participantCount: participantStats.participantCount,
          officeOpenAtTimestamp: getEventOfficeOpenAt(event)?.getTime() ?? 0,
        };
      })
      .sort((left, right) => right.officeOpenAtTimestamp - left.officeOpenAtTimestamp);
  }, [archivedEvents, id, participantStatsByEventId]);

  if (isLoading) return <TableSkeleton rows={4} cols={4} subtitle="" />;
  if (!organization) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Nie znaleziono organizacji.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/organizations/${organization.id}`)}
        className="w-fit touch-manipulation"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Wróć do organizacji
      </Button>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Archiwum wydarzeń
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {organization.name}
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            {eventRows.length} archiwalnych
          </Badge>
        </div>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/10 shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">
            Archiwum wydarzeń przechowuje wydarzenia, które już się odbyły i
            zostały zamknięte w systemie.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Wydarzenia są automatycznie przenoszone do archiwum miesiąc po zamknięciu biura zawodów.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Takie wydarzenia nie pojawiają się na aktywnych listach, nie są
            dostępne w filtrach ani przypisaniach skanerów. Dane pozostają do
            podglądu, a zmiany w archiwum może wykonywać tylko superadmin.
          </p>
        </CardContent>
      </Card>

      {eventRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Ta organizacja nie ma jeszcze zarchiwizowanych wydarzeń.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="hidden md:table-cell">Lokalizacja</TableHead>
                  <TableHead>Biuro</TableHead>
                  <TableHead className="hidden sm:table-cell">Odprawieni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRows.map((event) => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer active:bg-accent/50"
                    onClick={() => navigate(`/events/${event.id}`)}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        navigate(`/events/${event.id}`);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Otwórz wydarzenie ${event.name}`}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{event.name}</span>
                        <span className="block truncate text-xs text-muted-foreground md:hidden">
                          {event.location}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {event.location}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatEventOfficeWindow(event)}
                    </TableCell>
                    <TableCell className="hidden text-sm tabular-nums sm:table-cell">
                      {event.checkedInCount}/{event.participantCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {eventRows.length} wydarzeń w archiwum
          </p>
        </>
      )}
    </div>
  );
}
