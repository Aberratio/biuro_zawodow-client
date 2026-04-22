import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useRouteEventContext } from "@/hooks/use-route-event-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  QrCode,
  Repeat,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import type {
  Participant,
  ParticipantFieldMapping,
  ParticipantQrPreview,
  ParticipantStatus,
} from "@/types";
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
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildParticipantFieldValues,
  getActiveParticipantMappings,
} from "@/lib/participant-fields";
import { formatBibNumber } from "@/lib/participants";
import { ParticipantBibNumberConflictDialog } from "@/components/ParticipantBibNumberConflictDialog";
import {
  getParticipantStatusDefinition,
  PARTICIPANT_STATUS_DEFINITIONS,
} from "@/lib/participant-status";
import { validateEmail, validateRequired } from "@/lib/form-validation";
import { OnlineOnlyNotice } from "@/components/OnlineOnlyNotice";
import {
  canManageParticipantData as canManageParticipantDataForRole,
  canUseParticipantAdminActions,
} from "@/lib/roles";
import {
  buildEventParticipantsPath,
} from "@/lib/routes";

function formatParticipantDateTime(value: string): string {
  const normalizedValue = value.includes(" ") ? value.replace(" ", "T") : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

function getTimelineIcon(action: string) {
  const normalizedAction = action.toLocaleLowerCase("pl-PL");

  if (normalizedAction.includes("qr") || normalizedAction.includes("mail"))
    return Mail;
  if (normalizedAction.includes("przepis")) return Repeat;
  if (normalizedAction.includes("usun")) return Trash2;
  if (
    normalizedAction.includes("status") ||
    normalizedAction.includes("check-in") ||
    normalizedAction.includes("skan")
  )
    return CheckCircle;
  return Clock;
}

export default function ParticipantDetails() {
  const { id: routeEventId = "", participantId = "" } = useParams<{
    id: string;
    participantId: string;
  }>();
  const navigate = useNavigate();
  const {
    participants,
    events,
    activityLog,
    currentRole,
    updateParticipantStatus,
    updateParticipantBibNumber,
    updateParticipantDetails,
    getParticipantFieldMappings,
    sendParticipantQrEmail,
    deleteParticipant,
    getParticipantQrPreview,
    isLoading,
    connectionState,
  } = useData();
  const participant = participants.find((entry) => entry.id === participantId);
  const event = events.find((entry) => entry.id === participant?.event_id);
  const [qrPreview, setQrPreview] = useState<ParticipantQrPreview | null>(null);
  const [mappings, setMappings] = useState<ParticipantFieldMapping[]>([]);
  const [statusValue, setStatusValue] =
    useState<ParticipantStatus>("not_checked_in");
  const [transferOpen, setTransferOpen] = useState(false);
  const [sendQrConfirmOpen, setSendQrConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bibNumberConflictOpen, setBibNumberConflictOpen] = useState(false);
  const [bibNumberConflictParticipants, setBibNumberConflictParticipants] =
    useState<Participant[]>([]);
  const [pendingBibNumberCandidate, setPendingBibNumberCandidate] =
    useState("");
  const [bibNumberValue, setBibNumberValue] = useState("");
  const [bibNumberError, setBibNumberError] = useState<string | undefined>();
  const [transferEmail, setTransferEmail] = useState("");
  const [transferFields, setTransferFields] = useState<Record<string, string>>(
    {},
  );
  const [transferErrors, setTransferErrors] = useState<{
    email?: string;
    fields: Record<string, string>;
    form?: string;
  }>({ fields: {} });
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSendingQr, setIsSendingQr] = useState(false);
  const [isSavingBibNumber, setIsSavingBibNumber] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [isDeletingParticipant, setIsDeletingParticipant] = useState(false);
  const canManageParticipantData =
    canManageParticipantDataForRole(currentRole);
  const canUseAdminActions = canUseParticipantAdminActions(currentRole);
  const isOnline = connectionState === "online";

  useRouteEventContext(routeEventId);

  useEffect(() => {
    if (!participant) return;
    setStatusValue(participant.status);
    setBibNumberValue(participant.bib_number);
    setBibNumberError(undefined);
    setBibNumberConflictOpen(false);
    setBibNumberConflictParticipants([]);
    setPendingBibNumberCandidate("");
    setTransferEmail(participant.email);
  }, [participant]);

  useEffect(() => {
    if (!participant?.event_id || !canManageParticipantData || !isOnline)
      return;

    void getParticipantFieldMappings(participant.event_id)
      .then((data) => {
        setMappings(data);
        setTransferFields(buildParticipantFieldValues(data, participant));
      })
      .catch(() => {
        setMappings([]);
        setTransferFields({});
      });
  }, [
    canManageParticipantData,
    getParticipantFieldMappings,
    isOnline,
    participant,
  ]);

  useEffect(() => {
    if (!participant?.id || !canUseAdminActions || !isOnline) return;

    setIsQrLoading(true);
    void getParticipantQrPreview(participant.id)
      .then(setQrPreview)
      .catch((error) => {
        toast({
          title: "Nie udało się pobrać podglądu QR",
          description: error instanceof Error ? error.message : "Błąd API",
          variant: "destructive",
        });
      })
      .finally(() => setIsQrLoading(false));
  }, [canUseAdminActions, getParticipantQrPreview, isOnline, participant?.id]);

  const activeMappings = useMemo(
    () => getActiveParticipantMappings(mappings),
    [mappings],
  );
  const editableMappings = useMemo(
    () =>
      activeMappings.filter((mapping) => mapping.field_role !== "bib_number"),
    [activeMappings],
  );
  const participantDataEntries = useMemo(() => {
    if (!participant) return [];

    const entries = [
      { label: "Imię i nazwisko", value: participant.name },
      { label: "Email", value: participant.email },
    ];
    const mappedValues = buildParticipantFieldValues(mappings, participant);
    const seenLabels = new Set(["Imię i nazwisko", "Email"]);

    for (const mapping of activeMappings) {
      if (mapping.field_role === "bib_number") continue;
      const value = (mappedValues[mapping.alias] ?? "").trim();
      if (!value) continue;
      entries.push({ label: mapping.alias, value });
      seenLabels.add(mapping.alias);
    }

    for (const [label, value] of Object.entries(
      participant.custom_fields ?? {},
    )) {
      const normalizedLabel = label.trim();
      const normalizedValue = value.trim();
      if (
        !normalizedLabel ||
        !normalizedValue ||
        seenLabels.has(normalizedLabel)
      )
        continue;
      entries.push({ label: normalizedLabel, value: normalizedValue });
    }

    return entries;
  }, [activeMappings, mappings, participant]);

  const timeline = useMemo(() => {
    if (!participant) return [];

    const participantApiId = participant.id.replace(/^p-/, "");
    const participantLogs = activityLog
      .filter((log) => String(log.participant_id ?? "") === participantApiId)
      .map((log) => ({
        time: formatParticipantDateTime(log.timestamp),
        desc: log.user_name ? `${log.action} (${log.user_name})` : log.action,
        icon: getTimelineIcon(log.action),
      }));

    if (participantLogs.length > 0) {
      return participantLogs;
    }

    const status = getParticipantStatusDefinition(participant.status);

    return [
      {
        time: "Brak dokładnej daty",
        desc: "Uczestnik znajduje sie na liscie startowej",
        icon: Clock,
      },
      ...(participant.email_status === "sent"
        ? [
            {
              time: "Brak dokładnej daty",
              desc: "Kod QR został wysłany mailem",
              icon: Mail,
            },
          ]
        : []),
      ...(participant.checked_in_at
        ? [
            {
              time: formatParticipantDateTime(participant.checked_in_at),
              desc: status.label,
              icon: CheckCircle,
            },
          ]
        : []),
    ];
  }, [activityLog, participant]);

  if (isLoading) return <DetailSkeleton />;
  if (!participant)
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nie znaleziono uczestnika
      </div>
    );

  const participantEventId = routeEventId || participant.event_id || event?.id || "";
  const backTo = participantEventId
    ? buildEventParticipantsPath(participantEventId)
    : "/events";
  const backLabel = participantEventId
    ? "Wróć do uczestników"
    : "Wróć do wydarzeń";

  const statusDefinition = getParticipantStatusDefinition(participant.status);
  const normalizedBibNumberValue = bibNumberValue.trim();
  const normalizedCurrentBibNumber = participant.bib_number.trim();

  const handleSendQr = async () => {
    setSendQrConfirmOpen(false);
    setIsSendingQr(true);
    try {
      const result = await sendParticipantQrEmail(participant.id);
      if (!result.ok) {
        toast({
          title: "Nie udało się wysłać maila",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Mail z QR wysłany", description: participant.name });
    } finally {
      setIsSendingQr(false);
    }
  };

  const handleSaveStatus = async () => {
    if (statusValue === participant.status) return;

    setIsSavingStatus(true);
    try {
      const result = await updateParticipantStatus(participant.id, statusValue);
      if (!result.ok) {
        toast({
          title: "Nie udało się zmienić statusu",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Status uczestnika zaktualizowany" });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveBibNumber = async () => {
    const normalizedBibNumber = bibNumberValue.trim();
    if (normalizedBibNumber.length > 32) {
      setBibNumberError("Numer startowy może mieć maksymalnie 32 znaki.");
      return;
    }

    setBibNumberError(undefined);
    setIsSavingBibNumber(true);
    try {
      const result = await updateParticipantBibNumber(
        participant.id,
        normalizedBibNumber,
      );
      if (result.conflict) {
        setPendingBibNumberCandidate(result.conflict.bibNumber);
        setBibNumberConflictParticipants(
          result.conflict.conflictingParticipants,
        );
        setBibNumberConflictOpen(true);
        return;
      }
      if (!result.ok) {
        setBibNumberError(result.error);
        toast({
          title: "Nie udało się zapisać numeru startowego",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: normalizedBibNumber
          ? "Numer startowy zapisany"
          : "Numer startowy wyczyszczony",
      });
    } finally {
      setIsSavingBibNumber(false);
    }
  };

  const handleResolveBibNumberConflict = async (
    resolution: "keep_duplicates" | "delete_conflicts",
  ) => {
    setIsSavingBibNumber(true);
    try {
      const result = await updateParticipantBibNumber(
        participant.id,
        pendingBibNumberCandidate,
        { conflictResolution: resolution },
      );
      if (!result.ok) {
        setBibNumberError(result.error);
        toast({
          title: "Nie udało się zapisać numeru startowego",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setBibNumberConflictOpen(false);
      setBibNumberConflictParticipants([]);
      setPendingBibNumberCandidate("");
      toast({
        title:
          resolution === "delete_conflicts"
            ? "Numer przeniesiony i konflikty usunięte"
            : "Numer startowy zapisany dla wielu uczestników",
      });
    } finally {
      setIsSavingBibNumber(false);
    }
  };

  const handleTransferFieldChange = (alias: string, value: string) => {
    setTransferFields((previous) => ({ ...previous, [alias]: value }));
    setTransferErrors((previous) => ({
      ...previous,
      fields: { ...previous.fields, [alias]: "" },
      form: undefined,
    }));
  };

  const handleTransferSubmit = async () => {
    const fieldErrors = activeMappings.reduce<Record<string, string>>(
      (accumulator, mapping) => {
        if (mapping.field_role === "bib_number") return accumulator;
        const error = validateRequired(
          transferFields[mapping.alias] ?? "",
          `Uzupełnij pole: ${mapping.alias}.`,
        );
        if (error) accumulator[mapping.alias] = error;
        return accumulator;
      },
      {},
    );
    void fieldErrors;
    const nextErrors = {
      email: validateEmail(transferEmail),
      fields: {},
    };

    if (nextErrors.email) {
      setTransferErrors(nextErrors);
      return;
    }

    setTransferErrors({ fields: {} });
    setIsSavingTransfer(true);
    try {
      const result = await updateParticipantDetails(
        participant.id,
        transferEmail,
        transferFields,
      );
      if (!result.ok) {
        setTransferErrors({
          fields: {},
          form: result.error ?? "Nie udało się zapisać danych uczestnika.",
        });
        toast({
          title: "Nie udało się zapisać danych uczestnika",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setTransferOpen(false);
      setTransferErrors({ fields: {} });
      toast({ title: "Dane uczestnika zaktualizowane" });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const handleDeleteParticipant = async () => {
    setIsDeletingParticipant(true);
    const result = await deleteParticipant(participant.id);
    setIsDeletingParticipant(false);

    if (!result.ok) {
      toast({
        title: "Nie udało się usunąć uczestnika",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setDeleteConfirmOpen(false);
    toast({ title: "Uczestnik usunięty" });
    navigate(
      participant.event_id
        ? buildEventParticipantsPath(participant.event_id)
        : "/events",
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(backTo)}
        className="touch-manipulation"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {backLabel}
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {participant.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {participant.email}
          </p>
          {event && (
            <p className="text-xs text-muted-foreground mt-1">{event.name}</p>
          )}
        </div>
        {canManageParticipantData && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setTransferOpen(true)}
              disabled={!isOnline}
            >
              <UserRoundCog className="h-4 w-4 mr-1" />
              Edytuj dane uczestnika
            </Button>
            {canUseAdminActions && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setSendQrConfirmOpen(true)}
                disabled={isSendingQr || !isOnline}
              >
                {isSendingQr ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Repeat className="h-4 w-4 mr-1" />
                )}
                {participant.email_status === "sent"
                  ? "Wyślij ponownie QR"
                  : "Wyślij QR"}
              </Button>
            )}
          </div>
        )}
      </div>

      {canUseAdminActions && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={!isOnline}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Usuń uczestnika
          </Button>
        </div>
      )}

      {!isOnline && (
        <OnlineOnlyNotice description="Podgląd QR, edycja danych i statusu, wysyłka maila oraz usuwanie uczestnika wymagają aktywnego połączenia z serwerem." />
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Szczegóły uczestnika</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Numer startowy</span>
              <span className="font-semibold tabular-nums">
                {formatBibNumber(participant.bib_number)}
              </span>
            </div>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusDefinition.badgeVariant}>
                {statusDefinition.label}
              </Badge>
            </div>
            {(participant.sync_state === "pending_sync" ||
              participant.sync_state === "requires_review") && (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Synchronizacja</span>
                <Badge
                  variant={
                    participant.sync_state === "pending_sync"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {participant.sync_state === "pending_sync"
                    ? "Oczekuje na synchronizację"
                    : "Wymaga weryfikacji"}
                </Badge>
              </div>
            )}
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Mail z QR</span>
              <Badge
                variant={
                  participant.email_status === "sent" ? "default" : "secondary"
                }
              >
                {participant.email_status === "sent" ? "Wysłany" : "Oczekuje"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:justify-between">
              <span className="text-muted-foreground">Token QR</span>
              <span className="font-mono text-xs break-all sm:max-w-[18rem] sm:text-right">
                {participant.qr_code}
              </span>
            </div>
            {canManageParticipantData && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="participant-bib-number">Numer startowy</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="participant-bib-number"
                    value={bibNumberValue}
                    onChange={(event) => {
                      setBibNumberValue(event.target.value);
                      setBibNumberError(undefined);
                    }}
                    placeholder="Np. 101"
                    className="sm:flex-1"
                    aria-invalid={Boolean(bibNumberError)}
                    aria-describedby={
                      bibNumberError
                        ? "participant-bib-number-error"
                        : undefined
                    }
                  />
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => void handleSaveBibNumber()}
                    disabled={
                      isSavingBibNumber ||
                      normalizedBibNumberValue === normalizedCurrentBibNumber ||
                      !isOnline
                    }
                  >
                    {isSavingBibNumber && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Zapisz numer
                  </Button>
                </div>
                <FieldError id="participant-bib-number-error">
                  {bibNumberError}
                </FieldError>
                <p className="text-xs text-muted-foreground">
                  Pole może pozostać puste. Numer powinien być unikalny w ramach
                  wydarzenia.
                </p>
              </div>
            )}
            {canManageParticipantData && (
              <div className="space-y-2 pt-2">
                <Label>Zmień status</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={statusValue}
                    onValueChange={(value) =>
                      setStatusValue(value as ParticipantStatus)
                    }
                  >
                    <SelectTrigger className="sm:flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTICIPANT_STATUS_DEFINITIONS.map((status) => (
                        <SelectItem key={status.code} value={status.code}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => void handleSaveStatus()}
                    disabled={
                      isSavingStatus ||
                      statusValue === participant.status ||
                      !isOnline
                    }
                  >
                    {isSavingStatus && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Zapisz status
                  </Button>
                </div>
                {statusValue === "checked_in_not_starting" && (
                  <p className="text-xs text-muted-foreground">
                    Pakiet odebrany, uczestnik nie wystartuje.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Podgląd QR</CardTitle>
          </CardHeader>
          <CardContent>
            {isQrLoading ? (
              <div className="aspect-square rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : qrPreview?.qr_code_svg_data_uri ? (
              <div className="space-y-3">
                <div className="rounded-2xl border bg-white p-4">
                  <img
                    src={qrPreview.qr_code_svg_data_uri}
                    alt={`Kod QR uczestnika ${participant.name}`}
                    className="w-full h-auto"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Ten kod jednoznacznie wskazuje uczestnika w wybranych
                  zawodach.
                </div>
              </div>
            ) : (
              <div className="aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2">
                <QrCode className="h-8 w-8" />
                <span className="text-sm">Brak podglądu QR</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dane uczestnika</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {participantDataEntries.map((entry) => (
            <div
              key={entry.label}
              className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="font-medium sm:max-w-[60%] sm:text-right break-words">
                {entry.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeline.map((entry) => (
              <div
                key={`${entry.time}-${entry.desc}`}
                className="flex items-start gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <entry.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{entry.time}</p>
                  <p className="text-xs text-muted-foreground">{entry.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={transferOpen}
        onOpenChange={(nextOpen) => {
          setTransferOpen(nextOpen);
          if (!nextOpen) setTransferErrors({ fields: {} });
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Edytuj dane uczestnika</DialogTitle>
          </DialogHeader>
          <div className="themed-scrollbar grid flex-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="transfer-participant-email">Email</Label>
              <Input
                id="transfer-participant-email"
                type="email"
                value={transferEmail}
                onChange={(event) => {
                  setTransferEmail(event.target.value);
                  setTransferErrors((previous) => ({
                    ...previous,
                    email: undefined,
                    form: undefined,
                  }));
                }}
                className="mt-2"
                required
                aria-invalid={Boolean(transferErrors.email)}
                aria-describedby={
                  transferErrors.email
                    ? "transfer-participant-email-error"
                    : undefined
                }
              />
              <FieldError
                id="transfer-participant-email-error"
                className="mt-2"
              >
                {transferErrors.email}
              </FieldError>
            </div>
            {editableMappings.map((mapping, index) => {
              const fieldId = `transfer-participant-field-${index}`;
              const errorId = `${fieldId}-error`;
              const fieldError = transferErrors.fields[mapping.alias];

              return (
                <div key={`${mapping.alias}-${mapping.source_column_name}`}>
                  <Label htmlFor={fieldId}>{mapping.alias}</Label>
                  <Input
                    id={fieldId}
                    value={transferFields[mapping.alias] ?? ""}
                    onChange={(event) =>
                      handleTransferFieldChange(
                        mapping.alias,
                        event.target.value,
                      )
                    }
                    className="mt-2"
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? errorId : undefined}
                  />
                  <FieldError id={errorId} className="mt-2">
                    {fieldError}
                  </FieldError>
                </div>
              );
            })}
            <FieldError
              id="transfer-participant-form-error"
              className="lg:col-span-2"
            >
              {transferErrors.form}
            </FieldError>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button
              className="w-full sm:w-auto"
              onClick={() => void handleTransferSubmit()}
              disabled={isSavingTransfer}
            >
              {isSavingTransfer && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParticipantBibNumberConflictDialog
        open={bibNumberConflictOpen}
        onOpenChange={(nextOpen) => {
          setBibNumberConflictOpen(nextOpen);
          if (!nextOpen) {
            setPendingBibNumberCandidate("");
            setBibNumberConflictParticipants([]);
          }
        }}
        bibNumber={pendingBibNumberCandidate}
        conflictingParticipants={bibNumberConflictParticipants}
        allowDeleteConflicts={canUseAdminActions}
        isSaving={isSavingBibNumber}
        onResolve={handleResolveBibNumberConflict}
      />

      <AlertDialog open={sendQrConfirmOpen} onOpenChange={setSendQrConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Potwierdź wysyłkę maila z kodem QR
            </AlertDialogTitle>
            <AlertDialogDescription>
              Do uczestnika{" "}
              <span className="font-medium text-foreground">
                {participant.name}
              </span>{" "}
              zostanie wysłany mail na adres{" "}
              <span className="font-medium text-foreground">
                {participant.email}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleSendQr()}
              disabled={isSendingQr}
            >
              {isSendingQr && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Wyślij mail
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć uczestnika?</AlertDialogTitle>
            <AlertDialogDescription>
              Uczestnik{" "}
              <span className="font-medium text-foreground">
                {participant.name}
              </span>{" "}
              zostanie trwale usunięty z wydarzenia. Tej operacji nie da się
              cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteParticipant()}
              disabled={isDeletingParticipant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingParticipant && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Usuń uczestnika
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
