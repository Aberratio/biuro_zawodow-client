import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useRouteEventContext } from "@/hooks/use-route-event-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  FileUp,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { ParticipantFieldMapping } from "@/types";
import {
  buildEmptyParticipantFieldValues,
  getActiveParticipantMappings,
} from "@/lib/participant-fields";
import { formatBibNumber } from "@/lib/participants";
import {
  getParticipantStatusDefinition,
  PARTICIPANT_STATUS_DEFINITIONS,
} from "@/lib/participant-status";
import { validateEmail, validateRequired } from "@/lib/form-validation";
import { isScannerRole } from "@/lib/roles";
import { OnlineOnlyNotice } from "@/components/OnlineOnlyNotice";
import { PageHeader } from "@/components/PageHeader";
import { ParticipantFieldRoleHint } from "@/components/ParticipantFieldRoleHint";
import {
  buildEventImportPath,
  buildEventParticipantPath,
  buildEventParticipantsPath,
  buildEventPath,
} from "@/lib/routes";

type ParticipantSortKey = "name" | "email" | "bib_number" | "status";
type SortDirection = "asc" | "desc";

function normalizeParticipantText(value: string | null | undefined) {
  return String(value ?? "");
}

export default function Participants() {
  const {
    participants,
    selectedEventId,
    currentRole,
    isLoading,
    getParticipantFieldMappings,
    addParticipantManually,
    resetEventParticipantList,
    connectionState,
    refreshData,
  } = useData();
  const navigate = useNavigate();
  const { id: routeEventId = "" } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ParticipantSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualSaving, setManualSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetRequiresQrConfirm, setResetRequiresQrConfirm] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [manualErrors, setManualErrors] = useState<{
    email?: string;
    fields: Record<string, string>;
    form?: string;
  }>({ fields: {} });
  const isOnline = connectionState === "online";
  const activeEventId = routeEventId || selectedEventId;

  useRouteEventContext(routeEventId);

  const eventParticipants = useMemo(
    () =>
      participants.filter(
        (participant) => participant.event_id === activeEventId,
      ),
    [activeEventId, participants],
  );
  const sentQrEmailCount = useMemo(
    () => eventParticipants.filter((participant) => participant.email_status === "sent").length,
    [eventParticipants],
  );

  const filtered = useMemo(() => {
    return eventParticipants
      .filter((participant) => {
        const query = search.toLocaleLowerCase("pl");
        const participantName = normalizeParticipantText(
          participant.name,
        ).toLocaleLowerCase("pl");
        const participantEmail = normalizeParticipantText(
          participant.email,
        ).toLocaleLowerCase("pl");
        const participantBibNumber = normalizeParticipantText(
          participant.bib_number,
        );

        return (
          !query ||
          participantName.includes(query) ||
          participantEmail.includes(query) ||
          participantBibNumber.includes(query)
        );
      })
      .filter(
        (participant) =>
          statusFilter === "all" || participant.status === statusFilter,
      );
  }, [eventParticipants, search, statusFilter]);

  const sortedParticipants = useMemo(() => {
    const directionFactor = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((first, second) => {
      const firstStatus = getParticipantStatusDefinition(first.status).label;
      const secondStatus = getParticipantStatusDefinition(second.status).label;
      const firstValue = sortKey === "status" ? firstStatus : first[sortKey];
      const secondValue = sortKey === "status" ? secondStatus : second[sortKey];

      return (
        String(firstValue).localeCompare(String(secondValue), "pl", {
          numeric: true,
          sensitivity: "base",
        }) * directionFactor
      );
    });
  }, [filtered, sortDirection, sortKey]);

  useEffect(() => {
    if (!activeEventId || !isOnline) {
      setMappings([]);
      setManualFields({});
      return;
    }

    void getParticipantFieldMappings(activeEventId)
      .then((data) => {
        setMappings(data);
        setManualFields(buildEmptyParticipantFieldValues(data));
      })
      .catch(() => {
        setMappings([]);
        setManualFields({});
      });
  }, [activeEventId, getParticipantFieldMappings, isOnline]);

  const activeMappings = useMemo(
    () => getActiveParticipantMappings(mappings),
    [mappings],
  );
  const canImportParticipants =
    Boolean(activeEventId) && !isScannerRole(currentRole);
  const canResetParticipantList =
    Boolean(activeEventId) &&
    eventParticipants.length > 0 &&
    ["editor", "admin", "superadmin"].includes(currentRole);
  const canAddManually =
    eventParticipants.length > 0 &&
    mappings.length > 0 &&
    !isScannerRole(currentRole);

  const handleSort = (key: ParticipantSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortIcon = (key: ParticipantSortKey) => {
    if (sortKey !== key)
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    if (sortDirection === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
    return <ArrowDown className="h-3.5 w-3.5" />;
  };

  const renderSortHeader = (key: ParticipantSortKey, label: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => handleSort(key)}
      className="-ml-3 h-8 px-3 text-xs font-medium"
    >
      {label}
      {renderSortIcon(key)}
    </Button>
  );

  const handleManualFieldChange = (alias: string, value: string) => {
    setManualFields((prev) => ({ ...prev, [alias]: value }));
    setManualErrors((prev) => ({
      ...prev,
      fields: { ...prev.fields, [alias]: "" },
      form: undefined,
    }));
  };

  const handleManualSubmit = async () => {
    const fieldErrors = activeMappings
      .filter((mapping) => mapping.is_required)
      .reduce<Record<string, string>>(
        (accumulator, mapping) => {
          const error = validateRequired(
            manualFields[mapping.alias] ?? "",
            `Uzupełnij pole: ${mapping.alias}.`,
          );
          if (error) accumulator[mapping.alias] = error;
          return accumulator;
        },
        {},
      );
    const nextErrors = {
      email: validateEmail(manualEmail),
      fields: fieldErrors,
    };

    if (nextErrors.email || Object.keys(fieldErrors).length > 0) {
      setManualErrors(nextErrors);
      return;
    }

    setManualErrors({ fields: {} });
    setManualSaving(true);
    const result = await addParticipantManually(
      activeEventId,
      manualEmail,
      manualFields,
    );
    setManualSaving(false);

    if (!result.ok) {
      setManualErrors({
        fields: {},
        form: result.error ?? "Nie udało się dodać uczestnika.",
      });
      toast({
        title: "Nie udało się dodać uczestnika",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setManualOpen(false);
    setManualEmail("");
    setManualFields(buildEmptyParticipantFieldValues(mappings));
    setManualErrors({ fields: {} });
    toast({ title: "Dodano uczestnika ręcznie" });
  };

  const handleResetParticipantList = async () => {
    if (!activeEventId) return;

    setResetSaving(true);
    const result = await resetEventParticipantList(activeEventId, resetRequiresQrConfirm || sentQrEmailCount > 0);
    setResetSaving(false);

    if (!result.ok) {
      if (result.qrEmailsSent) {
        setResetRequiresQrConfirm(true);
        toast({
          title: "Potwierdź usunięcie po wysyłce QR",
          description: "Dla tego wydarzenia wysłano już maile z kodami QR. Potwierdź operację ponownie w oknie.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Nie udało się usunąć listy",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setResetDialogOpen(false);
    setResetRequiresQrConfirm(false);
    setMappings([]);
    setManualFields({});
    toast({
      title: "Usunięto listę uczestników",
      description: `Usunięto ${result.deleted_participant_count} uczestników i ${result.deleted_mapping_count} mapowań.`,
    });
  };

  if (isLoading)
    return <TableSkeleton rows={8} cols={4} subtitle="" showFilters />;

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(buildEventPath(activeEventId))}
            className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Wróć do wydarzenia
          </Button>
        </div>
        <PageHeader
          title="Uczestnicy"
          actions={
            <>
          <Button
            variant="outline"
            onClick={() => void refreshData()}
            disabled={!activeEventId || !isOnline || isLoading}
            title={
              !isOnline
                ? "Odświeżanie danych wymaga połączenia z serwerem."
                : undefined
            }
            className="h-11 w-full sm:h-10 sm:w-auto"
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Odśwież dane
          </Button>
          {canImportParticipants && (
            <Button
              variant="outline"
              onClick={() => navigate(buildEventImportPath(activeEventId))}
              disabled={!isOnline}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <FileUp className="h-4 w-4 mr-1" /> Import z pliku
            </Button>
          )}
          {canResetParticipantList && (
            <Button
              variant="outline"
              onClick={() => {
                setResetRequiresQrConfirm(false);
                setResetDialogOpen(true);
              }}
              disabled={!isOnline || resetSaving}
              className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-10 sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Usuń listę
            </Button>
          )}
          {canAddManually && (
            <Button
              onClick={() => setManualOpen(true)}
              className="h-11 w-full sm:h-10 sm:w-auto"
              disabled={!isOnline}
            >
              <UserPlus className="h-4 w-4 mr-1" /> Dodaj ręcznie
            </Button>
          )}
            </>
          }
        />
      </div>

      {!isOnline && (
        <p className="text-xs text-muted-foreground sm:text-right">
          Odświeżanie listy z bazy jest niedostępne bez połączenia z serwerem.
        </p>
      )}

      {!isOnline && !isScannerRole(currentRole) && (
        <OnlineOnlyNotice description="Import CSV i ręczne dodawanie uczestników są dostępne tylko po połączeniu z serwerem. Lista pozostaje dostępna do odczytu z lokalnego snapshotu." />
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po imieniu, email lub numerze..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-11 sm:h-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              {PARTICIPANT_STATUS_DEFINITIONS.map((status) => (
                <SelectItem key={status.code} value={status.code}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedParticipants.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Brak uczestników spełniających kryteria
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Spróbuj zmienić filtry lub wyszukaj inną frazę.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {renderSortHeader("name", "Imię i nazwisko")}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {renderSortHeader("email", "Email")}
                </TableHead>
                <TableHead>{renderSortHeader("bib_number", "Numer")}</TableHead>
                <TableHead>{renderSortHeader("status", "Status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedParticipants.map((participant) => {
                const status = getParticipantStatusDefinition(
                  participant.status,
                );
                const participantName = normalizeParticipantText(
                  participant.name,
                ) || "Nieznany uczestnik";
                const participantEmail = normalizeParticipantText(
                  participant.email,
                );

                return (
                  <TableRow
                    key={participant.id}
                    className="cursor-pointer active:bg-accent/50"
                    onClick={() =>
                      navigate(buildEventParticipantPath(participant.event_id, participant.id), {
                        state: {
                          backTo: buildEventParticipantsPath(
                            participant.event_id,
                          ),
                          backLabel: "Wróć do listy uczestników wydarzenia",
                        },
                      })
                    }
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">
                          {participantName}
                        </span>
                        <span className="block md:hidden text-xs text-muted-foreground truncate">
                          {participantEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {participantEmail}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatBibNumber(participant.bib_number)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={status.badgeVariant}
                        className="text-[10px]"
                      >
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć listę uczestników?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Ta operacja usunie {eventParticipants.length} uczestników tego wydarzenia razem z mapowaniem CSV, bazą importu i logami zmian uczestników.
              </span>
              {sentQrEmailCount > 0 && (
                <span className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Dla {sentQrEmailCount} uczestników wysłano już maile z kodami QR. Usuwanie listy po wysyłce kodów QR to zły pomysł, bo wysłane kody przestaną pasować do aktualnej listy.
                  </span>
                </span>
              )}
              {resetRequiresQrConfirm && (
                <span className="block font-medium text-destructive">
                  Serwer wymaga dodatkowego potwierdzenia. Kliknij przycisk usunięcia jeszcze raz, jeśli na pewno chcesz kontynuować.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetSaving}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetSaving}
              onClick={(event) => {
                event.preventDefault();
                void handleResetParticipantList();
              }}
            >
              {resetSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              Usuń listę i mapowanie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={manualOpen}
        onOpenChange={(nextOpen) => {
          setManualOpen(nextOpen);
          if (!nextOpen) setManualErrors({ fields: {} });
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Dodaj uczestnika ręcznie</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar grid flex-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="manual-participant-email">Email</Label>
              <Input
                id="manual-participant-email"
                type="email"
                value={manualEmail}
                onChange={(event) => {
                  setManualEmail(event.target.value);
                  setManualErrors((prev) => ({
                    ...prev,
                    email: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(manualErrors.email)}
                aria-describedby={
                  manualErrors.email
                    ? "manual-participant-email-description manual-participant-email-error"
                    : "manual-participant-email-description"
                }
              />
              <ParticipantFieldRoleHint
                id="manual-participant-email-description"
                role="email"
                isRequired
              />
              <FieldError id="manual-participant-email-error" className="mt-2">
                {manualErrors.email}
              </FieldError>
            </div>
            {activeMappings.map((mapping, index) => {
              const fieldId = `manual-participant-field-${index}`;
              const errorId = `${fieldId}-error`;
              const descriptionId = `${fieldId}-description`;
              const fieldError = manualErrors.fields[mapping.alias];

              return (
                <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                  <Label htmlFor={fieldId}>{mapping.alias}</Label>
                  <Input
                    id={fieldId}
                    value={manualFields[mapping.alias] ?? ""}
                    onChange={(event) =>
                      handleManualFieldChange(mapping.alias, event.target.value)
                    }
                    className="mt-2"
                    required={mapping.is_required}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={
                      fieldError ? `${descriptionId} ${errorId}` : descriptionId
                    }
                  />
                  <ParticipantFieldRoleHint
                    id={descriptionId}
                    role={mapping.field_role}
                    isRequired={mapping.is_required}
                  />
                  <FieldError id={errorId} className="mt-2">
                    {fieldError}
                  </FieldError>
                </div>
              );
            })}
            <FieldError
              id="manual-participant-form-error"
              className="lg:col-span-2"
            >
              {manualErrors.form}
            </FieldError>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button
              className="w-full sm:w-auto"
              onClick={handleManualSubmit}
              disabled={manualSaving}
            >
              {manualSaving && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {!manualSaving && <Plus className="h-4 w-4 mr-1" />}
              Zapisz uczestnika
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
