import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Event,
  Participant,
  ParticipantQrPreview,
  QrEmailDeliveryReport,
} from "@/types";
import {
  API_BASE_URL,
  fetchJson,
  getApiErrorCode,
  isApiResponseError,
} from "@/lib/api";
import {
  type ApiParticipant,
  type ParticipantQrPreviewResponse,
  mapApiEventToUi,
  mapApiParticipantToUi,
  participantUiIdToApiId,
} from "@/lib/data-context-helpers";
import { buildExportFallbackName, downloadCsvResponse } from "@/lib/csv-export";

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

interface ParticipantBibNumberConflict {
  bibNumber: string;
  conflictingParticipants: Participant[];
}
interface ParticipantBibNumberUpdateResult extends MutationResult {
  conflict?: ParticipantBibNumberConflict;
}
interface ParticipantBibNumberUpdateOptions {
  conflictResolution?: "keep_duplicates" | "delete_conflicts";
}
type EventQrPaymentScope = "all" | "paid_only";
interface EventQrEmailResult {
  ok: boolean;
  sent_count: number;
  error_count: number;
  unpaid_count?: number;
  unknown_payment_count?: number;
  skipped_unpaid_count?: number;
  reconciled_count?: number;
  errors: Array<{
    participant_id: number;
    participant_name: string;
    error: string;
  }>;
  error?: string;
}

interface ParticipantUpdatePayload {
  status?: string;
  email?: string;
  bib_number?: string | null;
  bib_number_conflict_resolution?: "keep_duplicates" | "delete_conflicts";
  field_values?: Record<string, string>;
  client_mutation_id?: string;
  device_id?: string;
  event_id?: string;
  base_status?: string;
}

interface UseParticipantMutationsArgs {
  participants: Participant[];
  setParticipantRecords: Dispatch<SetStateAction<Participant[]>>;
  events: Event[];
  archivedEvents: Event[];
  ensureOnline: (message?: string) => string | null;
  applyOnlineOnly: <T>(
    executor: () => Promise<T>,
    offlineMessage?: string
  ) => Promise<T>;
  runMutation: (
    executor: () => Promise<MutationResult>
  ) => Promise<MutationResult>;
  handleNetworkFailure: (
    error: unknown,
    options?: { immediate?: boolean }
  ) => void;
  addLog: (action: string, participantName?: string) => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  loadBootstrap: (silent?: boolean) => Promise<void>;
  updateParticipantInApi: (
    participantId: string,
    data: ParticipantUpdatePayload
  ) => Promise<Participant>;
  replaceParticipantRecord: (participant: Participant) => void;
}

export function useParticipantMutations({
  participants,
  setParticipantRecords,
  events,
  archivedEvents,
  ensureOnline,
  applyOnlineOnly,
  runMutation,
  handleNetworkFailure,
  addLog,
  getAuthHeaders,
  loadBootstrap,
  updateParticipantInApi,
  replaceParticipantRecord,
}: UseParticipantMutationsArgs) {
  const updateParticipantBibNumber = useCallback(
    async (
      participantId: string,
      bibNumber: string,
      options?: ParticipantBibNumberUpdateOptions
    ): Promise<ParticipantBibNumberUpdateResult> => {
      const offlineError = ensureOnline(
        "Zmiana numeru startowego jest dostępna tylko po połączeniu z serwerem."
      );
      if (offlineError) return { ok: false, error: offlineError };

      try {
        const participant = await updateParticipantInApi(participantId, {
          bib_number: bibNumber.trim(),
          bib_number_conflict_resolution: options?.conflictResolution,
        });
        replaceParticipantRecord(participant);
        await loadBootstrap(true);
        return { ok: true };
      } catch (error) {
        handleNetworkFailure(error);
        if (
          isApiResponseError(error) &&
          error.status === 409 &&
          getApiErrorCode(error) === "bib_number_conflict"
        ) {
          const payload = error.payload as {
            data?: {
              bib_number?: string;
              conflicting_participants?: ApiParticipant[];
            };
          };

          return {
            ok: false,
            error: error.message,
            conflict: {
              bibNumber: String(payload.data?.bib_number ?? bibNumber.trim()),
              conflictingParticipants: Array.isArray(
                payload.data?.conflicting_participants
              )
                ? payload.data.conflicting_participants.map(
                    (conflictParticipant) =>
                      mapApiParticipantToUi(
                        conflictParticipant,
                        participants.find(
                          (participant) => participant.id === participantId
                        )?.event_id ?? ""
                      )
                  )
                : [],
            },
          };
        }

        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się zapisać numeru startowego.",
        };
      }
    },
    [
      ensureOnline,
      handleNetworkFailure,
      loadBootstrap,
      participants,
      replaceParticipantRecord,
      updateParticipantInApi,
    ]
  );

  const updateParticipantDetails = useCallback(
    async (
      participantId: string,
      email: string,
      fieldValues: Record<string, string>
    ) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const participant = await updateParticipantInApi(participantId, {
          email,
          field_values: fieldValues,
        });
        replaceParticipantRecord(participant);
        await loadBootstrap(true);
        return { ok: true };
      }),
    [
      ensureOnline,
      loadBootstrap,
      replaceParticipantRecord,
      runMutation,
      updateParticipantInApi,
    ]
  );

  const addParticipantManually = useCallback(
    async (
      eventId: string,
      email: string,
      fieldValues: Record<string, string>
    ) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(
            `${API_BASE_URL}/events/${eventId}/participants/manual`,
            {
              method: "POST",
              headers: getAuthHeaders(true),
              body: JSON.stringify({ email, field_values: fieldValues }),
            }
          )
        ).payload as { data?: ApiParticipant };
        if (payload.data) {
          const mapped = mapApiParticipantToUi(payload.data, eventId);
          setParticipantRecords((previous) => [...previous, mapped]);
          addLog("Dodano uczestnika", mapped.name);
        }
        return { ok: true };
      }),
    [addLog, ensureOnline, getAuthHeaders, runMutation, setParticipantRecords]
  );

  const deleteParticipant = useCallback(
    async (participantId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingParticipant = participants.find(
          (participant) => participant.id === participantId
        );
        await fetchJson(
          `${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`,
          { method: "DELETE", headers: getAuthHeaders() }
        );
        setParticipantRecords((previous) =>
          previous.filter((participant) => participant.id !== participantId)
        );
        if (existingParticipant)
          addLog("Usunięto uczestnika", existingParticipant.name);
        return { ok: true };
      }),
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      participants,
      runMutation,
      setParticipantRecords,
    ]
  );

  const sendParticipantQrEmail = useCallback(
    async (participantId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(
            `${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}/send-qr-email`,
            { method: "POST", headers: getAuthHeaders() }
          )
        ).payload as { data?: ApiParticipant };
        if (!payload.data)
          return { ok: false, error: "API QR email send failed" };
        replaceParticipantRecord(
          mapApiParticipantToUi(
            payload.data,
            participants.find((participant) => participant.id === participantId)
              ?.event_id ?? ""
          )
        );
        await loadBootstrap(true);
        return { ok: true };
      }),
    [
      ensureOnline,
      getAuthHeaders,
      loadBootstrap,
      participants,
      replaceParticipantRecord,
      runMutation,
    ]
  );

  const sendEventQrEmails = useCallback(
    async (
      eventId: string,
      resendAll = false,
      paymentScope: EventQrPaymentScope = "all"
    ): Promise<EventQrEmailResult> => {
      try {
        const offlineError = ensureOnline();
        if (offlineError)
          return {
            ok: false,
            sent_count: 0,
            error_count: 0,
            unpaid_count: 0,
            unknown_payment_count: 0,
            skipped_unpaid_count: 0,
            errors: [],
            error: offlineError,
          };
        const payload = (
          await fetchJson(`${API_BASE_URL}/events/${eventId}/send-qr-emails`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
              resend_all: resendAll,
              payment_scope: paymentScope,
            }),
            // Duża wysyłka (1600 uczestników to ok. 32 paczki po 50) nie mieści się w 2 minutach.
            // Przekroczenie timeoutu nie gubi już pracy: API oznacza uczestników paczka po paczce,
            // a ponowne kliknięcie dosyła tylko brakujących — duplikatów pilnuje guard po stronie API.
            timeoutMs: 600_000,
          })
        ).payload as {
          data?: {
            sent_count?: number;
            error_count?: number;
            unpaid_count?: number;
            unknown_payment_count?: number;
            skipped_unpaid_count?: number;
            reconciled_count?: number;
            errors?: Array<{
              participant_id: number;
              participant_name: string;
              error: string;
            }>;
          };
        };
        await loadBootstrap(true);
        return {
          ok: true,
          sent_count: Number(payload.data?.sent_count ?? 0),
          error_count: Number(payload.data?.error_count ?? 0),
          unpaid_count: Number(payload.data?.unpaid_count ?? 0),
          unknown_payment_count: Number(
            payload.data?.unknown_payment_count ?? 0
          ),
          skipped_unpaid_count: Number(payload.data?.skipped_unpaid_count ?? 0),
          reconciled_count: Number(payload.data?.reconciled_count ?? 0),
          errors: Array.isArray(payload.data?.errors)
            ? payload.data!.errors
            : [],
        };
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          sent_count: 0,
          error_count: 0,
          errors: [],
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się wysłać kodów QR.",
        };
      }
    },
    [ensureOnline, getAuthHeaders, handleNetworkFailure, loadBootstrap]
  );

  const getParticipantQrPreview = useCallback(
    async (participantId: string) => {
      const payload = (
        await applyOnlineOnly(
          async () =>
            fetchJson(
              `${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}/qr-preview`,
              { headers: getAuthHeaders() }
            ),
          "Podgląd QR jest dostępny tylko po połączeniu z serwerem."
        )
      ).payload as ParticipantQrPreviewResponse;
      if (!payload.data?.participant || !payload.data.event)
        throw new Error("API QR preview failed");
      const previewEvent = mapApiEventToUi(payload.data.event);
      return {
        participant: mapApiParticipantToUi(
          payload.data.participant,
          previewEvent.id
        ),
        event: previewEvent,
        qr_code_svg_data_uri: payload.data.qr_code_svg_data_uri ?? "",
        qr_code_image_url: payload.data.qr_code_image_url ?? "",
      } satisfies ParticipantQrPreview;
    },
    [applyOnlineOnly, getAuthHeaders]
  );

  const getEventQrEmailDeliveries = useCallback(
    async (eventId: string): Promise<QrEmailDeliveryReport> => {
      // Endpoint stronicuje odpowiedzi mailera po stronie API, więc dostaje dłuższy timeout.
      const payload = (
        await fetchJson(
          `${API_BASE_URL}/events/${eventId}/qr-email-deliveries`,
          {
            headers: getAuthHeaders(),
            timeoutMs: 30_000,
          }
        )
      ).payload as { data?: QrEmailDeliveryReport };
      if (!payload.data)
        throw new Error("API QR email deliveries returned empty payload");
      return payload.data;
    },
    [getAuthHeaders]
  );

  const exportEventParticipantChangesCsv = useCallback(
    async (eventId: string): Promise<MutationResult> => {
      const offlineError = ensureOnline();
      if (offlineError) return { ok: false, error: offlineError };
      try {
        const response = await fetch(
          `${API_BASE_URL}/events/${eventId}/participant-changes/export.csv`,
          { headers: getAuthHeaders() }
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          return {
            ok: false,
            error:
              payload.error ??
              `Eksport zmian uczestników nie powiódł się: ${response.status}`,
          };
        }
        await downloadCsvResponse(
          response,
          buildExportFallbackName(events, archivedEvents, eventId, "zmiany")
        );
        return { ok: true };
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się wyeksportować CSV zmian uczestników",
        };
      }
    },
    [archivedEvents, ensureOnline, events, getAuthHeaders, handleNetworkFailure]
  );

  return {
    updateParticipantBibNumber,
    updateParticipantDetails,
    addParticipantManually,
    deleteParticipant,
    sendParticipantQrEmail,
    sendEventQrEmails,
    getParticipantQrPreview,
    getEventQrEmailDeliveries,
    exportEventParticipantChangesCsv,
  };
}
