import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

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
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/hooks/use-toast";
import {
  getApiErrorCode,
  getApiRetryAfter,
  isApiResponseError,
} from "@/lib/api";
import {
  PLATFORM_UNAVAILABLE_FOOTER,
  PLATFORM_UNAVAILABLE_HEADER,
  deletePlatformConnection,
  describeAvailabilityReason,
  describeLastPullCounts,
  describePullResult,
  describePullStatus,
  describeSkipReason,
  describeTestStatus,
  generateOrganizationToken,
  getPlatformConnection,
  pullPlatformParticipants,
  savePlatformConnection,
  testPlatformConnection,
  validatePlatformConnectionForm,
  type PlatformConnectionFormErrors,
  type PlatformConnectionInput,
  type PlatformConnectionView,
  type PlatformPullSkippedRecord,
} from "@/lib/platform-connection";

const PULL_RECHECK_DELAY_MS = 5000;

interface EventPlatformConnectionSectionProps {
  eventId: string;
  isOnline: boolean;
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pl-PL");
}

function extractFieldErrors(
  error: unknown
): PlatformConnectionFormErrors | null {
  if (!isApiResponseError(error) || error.status !== 422) return null;
  const payload = error.payload as { fields?: Record<string, string> } | null;
  const fields = payload?.fields;
  if (!fields) return null;

  const errors: PlatformConnectionFormErrors = {};
  if (fields.platform_event_id)
    errors.platformEventId = fields.platform_event_id;
  if (fields.organization_token) errors.token = fields.organization_token;
  return errors;
}

export function EventPlatformConnectionSection({
  eventId,
  isOnline,
}: EventPlatformConnectionSectionProps) {
  const { getAuthHeaders: getAuthHeadersFromContext } = useAuth();
  // Keep the latest function in a ref so a new function identity never re-triggers loading.
  const authHeadersRef = useRef(getAuthHeadersFromContext);
  authHeadersRef.current = getAuthHeadersFromContext;
  const getAuthHeaders = useCallback(
    (json = false) => authHeadersRef.current(json),
    []
  );
  const [view, setView] = useState<PlatformConnectionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [platformEventId, setPlatformEventId] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [errors, setErrors] = useState<PlatformConnectionFormErrors>({});
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const { refreshData } = useData();
  const [isPulling, setIsPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [skippedRecords, setSkippedRecords] = useState<
    PlatformPullSkippedRecord[]
  >([]);
  const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (recheckTimerRef.current !== null) {
        clearTimeout(recheckTimerRef.current);
      }
    },
    []
  );

  const applyView = useCallback((next: PlatformConnectionView) => {
    setView(next);
    setPlatformEventId(next.connection?.platform_event_id ?? "");
    setIsEnabled(next.connection?.is_enabled ?? false);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      applyView(await getPlatformConnection(eventId, getAuthHeaders()));
    } catch {
      setLoadError("Nie udało się wczytać ustawień integracji z platformą.");
    } finally {
      setIsLoading(false);
    }
  }, [applyView, eventId, getAuthHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const connection = view?.connection ?? null;
  const available = view?.availability.available ?? false;
  const formDisabled = !available || !isOnline || isSaving || isDeleting;
  const canPullHelp =
    available && isOnline && !(connection?.is_enabled ?? false);
  const canPull =
    available &&
    isOnline &&
    !!connection &&
    connection.is_enabled &&
    !isPulling &&
    !isSaving &&
    !isDeleting;
  const idErrorId = "platform-event-id-error";
  const tokenErrorId = "platform-token-error";

  const handleGenerate = () => {
    setToken(generateOrganizationToken());
    setShowToken(true);
    setErrors((current) => ({ ...current, token: undefined }));
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast({ title: "Skopiowano token" });
    } catch {
      toast({
        title: "Nie udało się skopiować tokenu",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSummaryError(null);
    const validation = validatePlatformConnectionForm({
      platformEventId,
      token,
      hasStoredToken: connection?.token_set ?? false,
    });
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    const body: PlatformConnectionInput = {
      platform_event_id: platformEventId.trim(),
      is_enabled: isEnabled,
    };
    if (token.trim() !== "") {
      body.organization_token = token.trim();
    }

    setIsSaving(true);
    try {
      applyView(
        await savePlatformConnection(eventId, getAuthHeaders(true), body)
      );
      setToken("");
      setShowToken(false);
      setTestMessage(null);
      toast({ title: "Zapisano połączenie z platformą" });
    } catch (error) {
      const fieldErrors = extractFieldErrors(error);
      if (fieldErrors) {
        setErrors(fieldErrors);
        setSummaryError("Popraw zaznaczone pola.");
      } else if (
        getApiErrorCode(error) === "platform_event_already_connected" &&
        isApiResponseError(error)
      ) {
        setErrors({ platformEventId: error.message });
        setSummaryError(error.message);
      } else if (isApiResponseError(error)) {
        setSummaryError(error.message);
      } else {
        setSummaryError("Nie udało się zapisać połączenia. Spróbuj ponownie.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const outcome = await testPlatformConnection(eventId, getAuthHeaders());
      setTestMessage({
        text: describeTestStatus(
          outcome.result.status,
          outcome.result.participant_count
        ),
        ok: outcome.result.status === "ok",
      });
      setView((current) =>
        current ? { ...current, connection: outcome.connection } : current
      );
    } catch (error) {
      const retryAfter = getApiRetryAfter(error);
      if (retryAfter !== null) {
        setTestMessage({
          text: `Odczekaj ${retryAfter} s przed kolejnym testem.`,
          ok: false,
        });
      } else if (isApiResponseError(error)) {
        setTestMessage({ text: error.message, ok: false });
      } else {
        setTestMessage({
          text: "Nie udało się wykonać testu połączenia.",
          ok: false,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setPullMessage(null);
    setSkippedRecords([]);
    try {
      const outcome = await pullPlatformParticipants(eventId, getAuthHeaders());
      const succeeded =
        outcome.result.status === "ok" || outcome.result.status === "partial";
      setPullMessage({
        text: describePullResult(outcome.result),
        ok: succeeded,
      });
      setSkippedRecords(outcome.result.skipped_records ?? []);
      setView((current) =>
        current ? { ...current, connection: outcome.connection } : current
      );
      if (succeeded) {
        try {
          await refreshData(true);
        } catch {
          // The pull itself succeeded; the list refreshes on the next sync.
        }
      }
    } catch (error) {
      const retryAfter = getApiRetryAfter(error);
      if (retryAfter !== null) {
        setPullMessage({
          text: `Odczekaj ${retryAfter} s przed kolejnym pobraniem.`,
          ok: false,
        });
      } else if (isApiResponseError(error)) {
        setPullMessage({ text: error.message, ok: false });
      } else {
        setPullMessage({
          text: "Nie udało się potwierdzić wyniku pobierania. Sprawdź ostatni wynik za chwilę.",
          ok: false,
        });
        recheckTimerRef.current = setTimeout(() => {
          getPlatformConnection(eventId, getAuthHeaders())
            .then(applyView)
            .catch(() => undefined);
        }, PULL_RECHECK_DELAY_MS);
      }
    } finally {
      setIsPulling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setSummaryError(null);
    try {
      applyView(await deletePlatformConnection(eventId, getAuthHeaders()));
      setToken("");
      setTestMessage(null);
      setErrors({});
      setDeleteOpen(false);
      toast({ title: "Odłączono wydarzenie od platformy" });
    } catch (error) {
      setDeleteOpen(false);
      setSummaryError(
        isApiResponseError(error)
          ? error.message
          : "Nie udało się odłączyć wydarzenia."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Wczytywanie ustawień integracji…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {loadError}
        </p>
        <Button variant="outline" onClick={() => void load()}>
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  const idDescribedBy = [
    "platform-event-id-help",
    errors.platformEventId ? idErrorId : null,
  ]
    .filter(Boolean)
    .join(" ");
  const tokenDescribedBy = [
    "platform-token-help",
    errors.token ? tokenErrorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-5">
      {!available && view && (
        <Alert>
          <p className="text-sm font-semibold">{PLATFORM_UNAVAILABLE_HEADER}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {view.availability.reasons.map((reason) => (
              <li key={reason}>{describeAvailabilityReason(reason)}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">{PLATFORM_UNAVAILABLE_FOOTER}</p>
        </Alert>
      )}

      {!isOnline && (
        <p className="text-sm text-muted-foreground">
          Konfiguracja integracji wymaga połączenia z internetem.
        </p>
      )}

      {connection &&
        connection.token_set &&
        connection.token_readable === false && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-destructive"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            Zapisanego tokenu nie da się odczytać (zmieniono klucz szyfrowania
            na serwerze). Wklej token ponownie i zapisz.
          </p>
        )}

      {summaryError && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm font-medium text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {summaryError}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="platform-event-id">ID wydarzenia na platformie</Label>
        <Input
          id="platform-event-id"
          value={platformEventId}
          onChange={(event) => setPlatformEventId(event.target.value)}
          disabled={formDisabled}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={errors.platformEventId ? true : undefined}
          aria-describedby={idDescribedBy}
        />
        <p
          id="platform-event-id-help"
          className="text-xs text-muted-foreground"
        >
          Identyfikator wydarzenia widoczny w ustawieniach wydarzenia na
          platformie Zmierzymy Czas.
        </p>
        <FieldError id={idErrorId}>{errors.platformEventId}</FieldError>
      </div>

      <div className="space-y-2">
        <Label htmlFor="platform-token">Token organizacji</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="platform-token"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            disabled={formDisabled}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1"
            placeholder={
              connection?.token_set
                ? "Pozostaw puste, aby zachować zapisany token"
                : ""
            }
            aria-invalid={errors.token ? true : undefined}
            aria-describedby={tokenDescribedBy}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowToken((current) => !current)}
            aria-pressed={showToken}
            disabled={formDisabled}
          >
            {showToken ? (
              <EyeOff className="mr-1 h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            {showToken ? "Ukryj" : "Pokaż"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerate}
            disabled={formDisabled}
          >
            Wygeneruj token
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            disabled={formDisabled || token === ""}
          >
            <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
            Kopiuj
          </Button>
        </div>
        <p id="platform-token-help" className="text-xs text-muted-foreground">
          Wklej ten sam token w ustawieniach wydarzenia na platformie Zmierzymy
          Czas (przełącznik Biuro Zawodów). Po zapisaniu token nie będzie już
          wyświetlany.
        </p>
        {connection?.token_set && (
          <p className="text-xs text-muted-foreground">
            Token zapisany {formatDateTime(connection.token_updated_at)}, kończy
            się na …{connection.token_hint}. Pozostaw pole puste, aby go
            zachować.
          </p>
        )}
        <FieldError id={tokenErrorId}>{errors.token}</FieldError>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="platform-enabled"
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
          disabled={formDisabled}
        />
        <Label htmlFor="platform-enabled">Integracja włączona</Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={formDisabled}
        >
          {isSaving && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Zapisz połączenie
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleTest()}
          disabled={
            !available || !isOnline || !connection || isTesting || isSaving
          }
        >
          {isTesting && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Testuj połączenie
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handlePull()}
          disabled={!canPull}
          aria-busy={isPulling}
          aria-describedby={canPullHelp ? "platform-pull-help" : undefined}
        >
          {isPulling && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Pobierz uczestników teraz
        </Button>
        {connection && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            disabled={!isOnline || isDeleting || isSaving}
          >
            Odłącz
          </Button>
        )}
      </div>

      {canPullHelp && (
        <p id="platform-pull-help" className="text-xs text-muted-foreground">
          Włącz integrację i zapisz połączenie, aby pobierać uczestników.
        </p>
      )}

      <div aria-live="polite" className="min-h-5 space-y-1 text-sm">
        {pullMessage && (
          <p
            className={
              pullMessage.ok
                ? "flex items-start gap-2 text-emerald-700"
                : "flex items-start gap-2 text-destructive"
            }
          >
            {pullMessage.ok ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span>{pullMessage.text}</span>
          </p>
        )}
        {!pullMessage && connection?.last_pull_status && (
          <p className="text-muted-foreground">
            Ostatnie pobranie ({formatDateTime(connection.last_pull_at)}):{" "}
            {describePullStatus(connection.last_pull_status)}{" "}
            {describeLastPullCounts(
              connection.last_pull_status,
              connection.last_pull_summary
            )}
          </p>
        )}
        {testMessage && (
          <p
            className={
              testMessage.ok
                ? "flex items-start gap-2 text-emerald-700"
                : "flex items-start gap-2 text-destructive"
            }
          >
            {testMessage.ok ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span>{testMessage.text}</span>
          </p>
        )}
        {!testMessage && connection?.last_test_status && (
          <p className="text-muted-foreground">
            Ostatni test ({formatDateTime(connection.last_test_at)}):{" "}
            {describeTestStatus(connection.last_test_status, null)}
          </p>
        )}
      </div>

      {skippedRecords.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Pominięte rekordy (ID zapisu na platformie)
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {skippedRecords.map((record, index) => (
              <li key={`${record.registration_id}-${index}`}>
                {record.registration_id || "brak ID"} —{" "}
                {describeSkipReason(record.reason)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Odłączyć wydarzenie od platformy?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Zapisany token zostanie usunięty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              Odłącz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
