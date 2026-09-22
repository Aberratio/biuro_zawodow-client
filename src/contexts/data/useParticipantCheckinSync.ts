import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConnectionState,
  Event,
  Participant,
  ParticipantScanResult,
  ParticipantStatus,
  ScannerMode,
} from "@/types";
import {
  API_BASE_URL,
  fetchJson,
  isApiResponseError,
  isNetworkRequestError,
} from "@/lib/api";
import {
  type ApiParticipant,
  type ParticipantScanApiResponse,
  applyPendingMutations,
  createClientMutationId,
  extractConflictParticipant,
  getDeviceId,
  mapApiEventToUi,
  mapApiParticipantToUi,
  participantUiIdToApiId,
} from "@/lib/data-context-helpers";
import {
  deletePendingMutation,
  loadPendingMutations,
  savePendingMutation,
  updatePendingMutation,
  type PendingParticipantMutation,
} from "@/lib/offline-store";

const OFFLINE_MUTATION_LIMIT = 20;
const OFFLINE_MUTATION_WINDOW_MS = 60_000;

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

export interface ParticipantUpdateOptions {
  allowOfflineQueue?: boolean;
}

interface ParticipantUpdatePayload {
  status?: ParticipantStatus;
  email?: string;
  bib_number?: string | null;
  bib_number_conflict_resolution?: "keep_duplicates" | "delete_conflicts";
  field_values?: Record<string, string>;
  client_mutation_id?: string;
  device_id?: string;
  event_id?: string;
  base_status?: ParticipantStatus;
}

function normalizeScanParticipantErrorMessage(error: unknown): string {
  if (isApiResponseError(error) && error.status === 403) {
    return "Ten kod QR należy do uczestnika z innego wydarzenia niż aktualnie wybrane.";
  }

  return error instanceof Error
    ? error.message
    : "Nie udało się odczytać uczestnika.";
}

interface UseParticipantCheckinSyncArgs {
  authUserId: string | undefined;
  token: string | null;
  connectionState: ConnectionState;
  diagnosticsIndexedDbAvailable: boolean;
  offlineDurationMs: number;
  participantRecords: Participant[];
  setParticipantRecords: (
    updater: (previous: Participant[]) => Participant[]
  ) => void;
  events: Event[];
  archivedEvents: Event[];
  selectedEventId: string;
  ensureOnline: (message?: string) => string | null;
  runMutation: (
    executor: () => Promise<MutationResult>
  ) => Promise<MutationResult>;
  addLog: (action: string, participantName?: string) => void;
  handleNetworkFailure: (
    error: unknown,
    options?: { immediate?: boolean }
  ) => void;
  markConnectionHealthy: () => void;
  setDegradedState: (source?: "none" | "network" | "cache") => void;
  loadBootstrap: (silent?: boolean) => Promise<void>;
  clearSession: () => void;
  resetState: () => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  setLastSyncAt: (value: string | null) => void;
  updateSyncMeta: (
    userId: string,
    nextLastSyncAt: string | null,
    nextOfflineSinceAt: string | null
  ) => Promise<void>;
}

export function useParticipantCheckinSync({
  authUserId,
  token,
  connectionState,
  diagnosticsIndexedDbAvailable,
  offlineDurationMs,
  participantRecords,
  setParticipantRecords,
  events,
  archivedEvents,
  selectedEventId,
  ensureOnline,
  runMutation,
  addLog,
  handleNetworkFailure,
  markConnectionHealthy,
  setDegradedState,
  loadBootstrap,
  clearSession,
  resetState,
  getAuthHeaders,
  setLastSyncAt,
  updateSyncMeta,
}: UseParticipantCheckinSyncArgs) {
  const [pendingMutations, setPendingMutations] = useState<
    PendingParticipantMutation[]
  >([]);
  const syncRef = useRef(false);

  const participants = useMemo(
    () => applyPendingMutations(participantRecords, pendingMutations),
    [participantRecords, pendingMutations]
  );

  const pendingMutationCount = useMemo(
    () =>
      pendingMutations.filter((mutation) => mutation.state === "queued").length,
    [pendingMutations]
  );

  const scannerMode = useMemo<ScannerMode>(() => {
    if (connectionState === "online") return "online";
    if (!diagnosticsIndexedDbAvailable) return "read_only";
    return offlineDurationMs > OFFLINE_MUTATION_WINDOW_MS ||
      pendingMutationCount > OFFLINE_MUTATION_LIMIT
      ? "read_only"
      : "offline_queue";
  }, [
    connectionState,
    diagnosticsIndexedDbAvailable,
    offlineDurationMs,
    pendingMutationCount,
  ]);

  const replaceParticipantRecord = useCallback(
    (participant: Participant) =>
      setParticipantRecords((previous) =>
        previous.map((item) =>
          item.id === participant.id
            ? { ...participant, sync_state: "synced", sync_error: undefined }
            : item
        )
      ),
    [setParticipantRecords]
  );

  useEffect(() => {
    if (!authUserId) {
      setPendingMutations([]);
      return;
    }
    void loadPendingMutations(API_BASE_URL, authUserId)
      .then(setPendingMutations)
      .catch(() => setPendingMutations([]));
  }, [authUserId]);

  const updateParticipantInApi = useCallback(
    async (participantId: string, data: ParticipantUpdatePayload) => {
      const payload = (
        await fetchJson(
          `${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`,
          {
            method: "PATCH",
            headers: getAuthHeaders(true),
            body: JSON.stringify(data),
          }
        )
      ).payload as { data?: ApiParticipant };
      if (!payload.data)
        throw new Error("API participant update returned empty payload");
      return mapApiParticipantToUi(
        payload.data,
        participants.find((participant) => participant.id === participantId)
          ?.event_id ?? ""
      );
    },
    [getAuthHeaders, participants]
  );

  const syncPendingMutations = useCallback(async () => {
    if (
      syncRef.current ||
      !authUserId ||
      !token ||
      connectionState !== "online"
    )
      return;
    const queue = pendingMutations.filter(
      (mutation) => mutation.state === "queued"
    );
    if (queue.length === 0) return;
    syncRef.current = true;
    let syncedAtLeastOne = false;
    try {
      for (const mutation of queue) {
        try {
          const participant = await updateParticipantInApi(
            mutation.participantId,
            {
              status: mutation.nextStatus,
              client_mutation_id: mutation.id,
              device_id: mutation.deviceId,
              event_id: mutation.eventId,
              base_status: mutation.baseStatus,
            }
          );
          replaceParticipantRecord(participant);
          await deletePendingMutation(mutation.id);
          setPendingMutations((previous) =>
            previous.filter((item) => item.id !== mutation.id)
          );
          syncedAtLeastOne = true;
        } catch (error) {
          if (isApiResponseError(error) && error.status === 401) {
            clearSession();
            break;
          }
          if (isApiResponseError(error) && error.status === 409) {
            const serverParticipant = extractConflictParticipant(error.payload);
            if (serverParticipant)
              replaceParticipantRecord(
                mapApiParticipantToUi(serverParticipant, mutation.eventId)
              );
            await updatePendingMutation(mutation.id, (current) =>
              current
                ? {
                    ...current,
                    state: "requires_review",
                    attempts: current.attempts + 1,
                    error: error.message,
                  }
                : null
            );
            setPendingMutations((previous) =>
              previous.map((item) =>
                item.id === mutation.id
                  ? {
                      ...item,
                      state: "requires_review",
                      attempts: item.attempts + 1,
                      error: error.message,
                    }
                  : item
              )
            );
            continue;
          }
          handleNetworkFailure(error);
          await updatePendingMutation(mutation.id, (current) =>
            current
              ? {
                  ...current,
                  state: "requires_review",
                  attempts: current.attempts + 1,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Nie udało się zsynchronizować statusu.",
                }
              : null
          );
          setPendingMutations((previous) =>
            previous.map((item) =>
              item.id === mutation.id
                ? {
                    ...item,
                    state: "requires_review",
                    attempts: item.attempts + 1,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Nie udało się zsynchronizować statusu.",
                  }
                : item
            )
          );
          break;
        }
      }
      if (syncedAtLeastOne && authUserId) {
        const syncedAt = new Date().toISOString();
        setLastSyncAt(syncedAt);
        await updateSyncMeta(authUserId, syncedAt, null);
      }
    } finally {
      syncRef.current = false;
    }
  }, [
    authUserId,
    clearSession,
    connectionState,
    handleNetworkFailure,
    pendingMutations,
    replaceParticipantRecord,
    setLastSyncAt,
    token,
    updateParticipantInApi,
    updateSyncMeta,
  ]);

  const enqueueStatusUpdate = useCallback(
    async (
      participantId: string,
      status: ParticipantStatus,
      options?: { syncImmediately?: boolean }
    ): Promise<MutationResult> => {
      const participant = participants.find(
        (item) => item.id === participantId
      );
      if (!participant)
        return { ok: false, error: "Nie znaleziono uczestnika." };
      if (scannerMode === "read_only" && connectionState !== "online") {
        const reason = diagnosticsIndexedDbAvailable
          ? "dane są zbyt stare albo kolejka zmian jest zbyt długa"
          : "przeglądarka blokuje trwałą pamięć offline";
        return {
          ok: false,
          error: `Skaner jest teraz tylko do odczytu, bo ${reason}.`,
        };
      }
      const mutation: PendingParticipantMutation = {
        id: createClientMutationId(),
        apiBaseUrl: API_BASE_URL,
        userId: authUserId ?? "unknown",
        participantId: participant.id,
        participantApiId: participantUiIdToApiId(participant.id),
        eventId: participant.event_id,
        nextStatus: status,
        baseStatus: participant.status,
        queuedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        state: "queued",
        attempts: 0,
      };
      await savePendingMutation(mutation);
      setPendingMutations((previous) => [...previous, mutation]);
      addLog(
        "Zmieniono status uczestnika (oczekuje na synchronizację)",
        participant.name
      );
      if (options?.syncImmediately) {
        void syncPendingMutations();
      } else {
        setDegradedState();
      }
      return { ok: true, queued: true };
    },
    [
      addLog,
      authUserId,
      connectionState,
      diagnosticsIndexedDbAvailable,
      participants,
      scannerMode,
      setDegradedState,
      syncPendingMutations,
    ]
  );

  const queueStatusUpdate = useCallback(
    async (
      participantId: string,
      status: ParticipantStatus
    ): Promise<MutationResult> =>
      enqueueStatusUpdate(participantId, status, {
        syncImmediately: connectionState === "online",
      }),
    [connectionState, enqueueStatusUpdate]
  );

  useEffect(() => {
    if (
      connectionState === "online" &&
      pendingMutations.some((mutation) => mutation.state === "queued")
    )
      void syncPendingMutations();
  }, [connectionState, pendingMutations, syncPendingMutations]);

  const updateParticipantStatus = useCallback(
    async (
      participantId: string,
      status: ParticipantStatus,
      options?: ParticipantUpdateOptions
    ) => {
      if (options?.allowOfflineQueue) {
        if (connectionState !== "online") {
          return queueStatusUpdate(participantId, status);
        }

        try {
          const participant = await updateParticipantInApi(participantId, {
            status,
          });
          replaceParticipantRecord(participant);
          await loadBootstrap(true);
          markConnectionHealthy();
          return { ok: true, queued: false };
        } catch (error) {
          if (isApiResponseError(error) && error.status === 401) {
            clearSession();
            resetState();
            return { ok: false, error: error.message };
          }

          if (isNetworkRequestError(error)) {
            handleNetworkFailure(error, { immediate: true });
            return enqueueStatusUpdate(participantId, status, {
              syncImmediately: false,
            });
          }

          handleNetworkFailure(error);
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Wystapil blad.",
          };
        }
      }
      return runMutation(async () => {
        const offlineError = ensureOnline(
          "Zmiana statusu uczestnika jest dostępna tylko po połączeniu z serwerem."
        );
        if (offlineError) return { ok: false, error: offlineError };
        const participant = await updateParticipantInApi(participantId, {
          status,
        });
        replaceParticipantRecord(participant);
        await loadBootstrap(true);
        return { ok: true };
      });
    },
    [
      clearSession,
      connectionState,
      enqueueStatusUpdate,
      ensureOnline,
      handleNetworkFailure,
      loadBootstrap,
      markConnectionHealthy,
      queueStatusUpdate,
      replaceParticipantRecord,
      resetState,
      runMutation,
      updateParticipantInApi,
    ]
  );

  const scanParticipantQr = useCallback(
    async (
      qrCode: string
    ): Promise<{
      ok: boolean;
      data?: ParticipantScanResult;
      error?: string;
      status?: number;
    }> => {
      const normalizedQrCode = qrCode.trim();
      if (!normalizedQrCode)
        return { ok: false, error: "Kod QR jest pusty.", status: 422 };
      const localParticipant = participants.find(
        (participant) =>
          participant.event_id === selectedEventId &&
          participant.qr_code === normalizedQrCode
      );
      const localEvent =
        events.find((event) => event.id === selectedEventId) ??
        archivedEvents.find((event) => event.id === selectedEventId);
      if (localParticipant && localEvent)
        return {
          ok: true,
          data: {
            participant: localParticipant,
            event: localEvent,
            access: { allowed: true },
          },
          status: 200,
        };
      if (connectionState !== "online")
        return {
          ok: false,
          error: "Nie znaleziono uczestnika w lokalnym snapshotcie wydarzenia.",
          status: 404,
        };
      try {
        const response = await fetchJson(`${API_BASE_URL}/participants/scan`, {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({ qr_code: normalizedQrCode }),
        });
        const payload = response.payload as ParticipantScanApiResponse;
        if (!payload.data?.participant || !payload.data.event)
          return {
            ok: false,
            error: "Nie znaleziono uczestnika dla tego kodu QR.",
            status: response.response.status,
          };
        const scanEvent = mapApiEventToUi(payload.data.event);
        return {
          ok: true,
          data: {
            participant: mapApiParticipantToUi(
              payload.data.participant,
              scanEvent.id
            ),
            event: scanEvent,
            access: { allowed: Boolean(payload.data.access?.allowed) },
          },
          status: response.response.status,
        };
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          error: normalizeScanParticipantErrorMessage(error),
          status: isApiResponseError(error) ? error.status : 0,
        };
      }
    },
    [
      archivedEvents,
      connectionState,
      events,
      getAuthHeaders,
      handleNetworkFailure,
      participants,
      selectedEventId,
    ]
  );

  return {
    participants,
    pendingMutationCount,
    scannerMode,
    updateParticipantInApi,
    replaceParticipantRecord,
    syncPendingMutations,
    enqueueStatusUpdate,
    queueStatusUpdate,
    updateParticipantStatus,
    scanParticipantQr,
  };
}
