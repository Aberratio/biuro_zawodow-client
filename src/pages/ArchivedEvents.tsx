import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowLeft } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useRouteOrganizationContext } from "@/hooks/use-route-organization-context";
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
import { PageHeader } from "@/components/PageHeader";
import { formatEventOfficeSchedule, getEventOfficeOpenAt } from "@/lib/events";
import { participantCountsAsCheckedIn } from "@/lib/participant-status";
import { buildOrganizationPath } from "@/lib/routes";

export default function ArchivedEvents() {
  const { id } = useParams<{ id: string }>();
  useRouteOrganizationContext(id ?? "");
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
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(buildOrganizationPath(organization.id))}
            className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Wróć do organizacji
          </Button>
        </div>

        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Archive className="h-6 w-6 shrink-0 text-primary" />
              <span>Archiwum wydarzeń</span>
            </span>
          }
          description={organization.name}
          actions={
            <Badge variant="outline" className="w-fit">
              {eventRows.length} archiwalnych
            </Badge>
          }
          headingClassName="flex items-center gap-2"
        />
      </div>

      <Card className="archive-notice shadow-sm">
        <CardContent className="p-5">
          <p className="archive-notice-title text-sm font-semibold">
            Archiwum wydarzeń przechowuje wydarzenia, które już się odbyły i
            zostały zamknięte w systemie.
          </p>
          <p className="archive-notice-copy mt-2 text-sm">
            Wydarzenia są automatycznie przenoszone do archiwum miesiąc po zamknięciu biura zawodów.
          </p>
          <p className="archive-notice-copy mt-2 text-sm">
            Takie wydarzenia nie pojawiają się na aktywnych listach, nie są
            dostępne w filtrach ani przypisaniach operatorów. Dane pozostają do
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
          <div className="w-full">
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
                    aria-label={`Wyświetl wydarzenie ${event.name}`}
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
                      {formatEventOfficeSchedule(event)}
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
