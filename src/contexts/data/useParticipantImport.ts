import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Participant, ParticipantFieldMapping } from "@/types";
import {
  API_BASE_URL,
  fetchJson,
  getApiErrorCode,
  isApiResponseError,
  isNetworkRequestError,
} from "@/lib/api";
import {
  type ApiParticipant,
  mapApiParticipantToUi,
} from "@/lib/data-context-helpers";

const PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS = 60_000;
const PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS = 10_000;

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

export interface ParticipantImportListDifference {
  columns_differ: boolean;
  missing_columns: string[];
  extra_columns: string[];
  participant_difference_ratio: number;
  should_offer_replacement: boolean;
}

export interface ParticipantImportAnalysis {
  headers: string[];
  sample_rows: Record<string, string>[];
  email_candidates: { column: string; matched_count: number }[];
  has_mapping: boolean;
  has_baseline_import: boolean;
  mappings: ParticipantFieldMapping[];
  missing_required_columns: string[];
  row_count: number;
  existing_participant_count: number;
  sent_qr_email_count: number;
  list_difference: ParticipantImportListDifference;
}

export interface ParticipantImportMappingFieldInput {
  source_column_name: string;
  alias: string;
  field_role:
    | "display_name_part"
    | "bib_number"
    | "payment_status"
    | "custom"
    | "important_custom";
  field_type?: ParticipantFieldMapping["field_type"];
  validation_rules?: ParticipantFieldMapping["validation_rules"];
  is_required?: boolean;
  is_active: boolean;
}

export interface ParticipantImportMappingPayload {
  csv_columns: string[];
  email_column: string;
  fields: ParticipantImportMappingFieldInput[];
}

export interface ParticipantFieldMappingUpdateResult extends MutationResult {
  mappings: ParticipantFieldMapping[];
  has_baseline_import: boolean;
}

export interface ParticipantImportRowIssue {
  row_number: number;
  reasons: string[];
  row: Record<string, string>;
  matched_by?: string;
}

export interface ParticipantImportRunResult {
  created_count: number;
  duplicate_count: number;
  invalid_count: number;
  invalid_rows: number[];
  invalid_row_details: ParticipantImportRowIssue[];
  duplicate_row_details: ParticipantImportRowIssue[];
  participants: Participant[];
  reset?: Record<string, unknown>;
}

export interface ParticipantListResetResult extends MutationResult {
  deleted_participant_count: number;
  deleted_mapping_count: number;
  deleted_baseline_record_count: number;
  deleted_change_log_count: number;
  qrEmailsSent?: boolean;
  sent_qr_email_count?: number;
}

export interface ParticipantFieldMappingsState {
  has_mapping: boolean;
  has_baseline_import: boolean;
  mappings: ParticipantFieldMapping[];
}

function mapParticipantImportRowIssues(
  value: unknown
): ParticipantImportRowIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object"
    )
    .map((entry) => ({
      row_number: Number(entry.row_number ?? 0),
      reasons: Array.isArray(entry.reasons)
        ? entry.reasons.map((reason) => String(reason))
        : [],
      row:
        entry.row && typeof entry.row === "object"
          ? Object.fromEntries(
              Object.entries(entry.row as Record<string, unknown>).map(
                ([key, cell]) => [key, String(cell ?? "")]
              )
            )
          : {},
      matched_by:
        typeof entry.matched_by === "string" ? entry.matched_by : undefined,
    }))
    .filter((entry) => entry.row_number > 0);
}

interface UseParticipantImportArgs {
  setParticipantRecords: Dispatch<SetStateAction<Participant[]>>;
  addLog: (action: string, participantName?: string) => void;
  applyOnlineOnly: <T>(
    executor: () => Promise<T>,
    offlineMessage?: string
  ) => Promise<T>;
  ensureOnline: (message?: string) => string | null;
  handleNetworkFailure: (
    error: unknown,
    options?: { immediate?: boolean }
  ) => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  loadBootstrap: (silent?: boolean) => Promise<void>;
}

export function useParticipantImport({
  setParticipantRecords,
  addLog,
  applyOnlineOnly,
  ensureOnline,
  handleNetworkFailure,
  getAuthHeaders,
  loadBootstrap,
}: UseParticipantImportArgs) {
  const participantFieldMappingsCacheRef = useRef(
    new Map<
      string,
      { fetchedAt: number; mappings: ParticipantFieldMapping[] }
    >()
  );
  const participantFieldMappingsInFlightRef = useRef(
    new Map<string, Promise<ParticipantFieldMapping[]>>()
  );
  const participantFieldMappingsStateCacheRef = useRef(
    new Map<
      string,
      { fetchedAt: number; state: ParticipantFieldMappingsState }
    >()
  );
  const participantFieldMappingsStateInFlightRef = useRef(
    new Map<string, Promise<ParticipantFieldMappingsState>>()
  );
  const participantFieldMappingsFailureUntilRef = useRef(
    new Map<string, number>()
  );

  // Preserves the original DataContext resetState behavior: only these three
  // caches were cleared on reset, not the *State* caches. Keep that as-is.
  const clearParticipantImportCaches = useCallback(() => {
    participantFieldMappingsCacheRef.current.clear();
    participantFieldMappingsInFlightRef.current.clear();
    participantFieldMappingsFailureUntilRef.current.clear();
  }, []);

  const analyzeParticipantImport = useCallback(
    async (eventId: string, csvContent: string) => {
      const payload = (
        await applyOnlineOnly(async () =>
          fetchJson(
            `${API_BASE_URL}/events/${eventId}/participant-imports/analyze`,
            {
              method: "POST",
              headers: getAuthHeaders(true),
              body: JSON.stringify({ csv_content: csvContent }),
            }
          )
        )
      ).payload as { data?: ParticipantImportAnalysis };

      if (!payload.data) {
        throw new Error("Nie udało się przeanalizować pliku CSV.");
      }

      return payload.data;
    },
    [applyOnlineOnly, getAuthHeaders]
  );

  const rememberParticipantFieldMappingsState = useCallback(
    (eventId: string, state: ParticipantFieldMappingsState) => {
      const fetchedAt = Date.now();
      participantFieldMappingsStateCacheRef.current.set(eventId, {
        fetchedAt,
        state,
      });
      participantFieldMappingsCacheRef.current.set(eventId, {
        fetchedAt,
        mappings: state.mappings,
      });
      participantFieldMappingsFailureUntilRef.current.delete(eventId);
    },
    []
  );

  const markParticipantImportBaselineCache = useCallback(
    (eventId: string) => {
      const cachedState =
        participantFieldMappingsStateCacheRef.current.get(eventId)?.state;
      const cachedMappings =
        participantFieldMappingsCacheRef.current.get(eventId)?.mappings;
      const mappings = cachedState?.mappings ?? cachedMappings ?? [];

      if (mappings.length === 0) {
        participantFieldMappingsStateCacheRef.current.delete(eventId);
        participantFieldMappingsFailureUntilRef.current.delete(eventId);
        return;
      }

      rememberParticipantFieldMappingsState(eventId, {
        has_mapping: true,
        has_baseline_import: true,
        mappings,
      });
    },
    [rememberParticipantFieldMappingsState]
  );

  const confirmParticipantImportMapping = useCallback(
    async (eventId: string, payload: ParticipantImportMappingPayload) => {
      const mappings =
        (
          (
            await applyOnlineOnly(async () =>
              fetchJson(
                `${API_BASE_URL}/events/${eventId}/participant-imports/confirm`,
                {
                  method: "POST",
                  headers: getAuthHeaders(true),
                  body: JSON.stringify(payload),
                }
              )
            )
          ).payload as { data?: ParticipantFieldMapping[] }
        ).data ?? [];
      const cachedState =
        participantFieldMappingsStateCacheRef.current.get(eventId)?.state;
      rememberParticipantFieldMappingsState(eventId, {
        has_mapping: mappings.length > 0,
        has_baseline_import: cachedState?.has_baseline_import ?? false,
        mappings,
      });
      return mappings;
    },
    [applyOnlineOnly, getAuthHeaders, rememberParticipantFieldMappingsState]
  );

  const runParticipantImport = useCallback(
    async (eventId: string, csvContent: string) => {
      const payload = (
        await applyOnlineOnly(async () =>
          fetchJson(
            `${API_BASE_URL}/events/${eventId}/participant-imports/run`,
            {
              method: "POST",
              headers: getAuthHeaders(true),
              body: JSON.stringify({ csv_content: csvContent }),
            }
          )
        )
      ).payload as { data?: Record<string, unknown> };
      const data = payload.data ?? {};
      const createdParticipants = Array.isArray(data.participants)
        ? data.participants.map((participant: ApiParticipant) =>
            mapApiParticipantToUi(participant, eventId)
          )
        : [];
      setParticipantRecords((previous) => [
        ...previous,
        ...createdParticipants,
      ]);
      if (createdParticipants.length > 0)
        addLog(`Import CSV (${createdParticipants.length} uczestników)`);
      if (createdParticipants.length > 0) {
        markParticipantImportBaselineCache(eventId);
      } else {
        participantFieldMappingsStateCacheRef.current.delete(eventId);
      }
      return {
        created_count: Number(data.created_count ?? 0),
        duplicate_count: Number(data.duplicate_count ?? 0),
        invalid_count: Number(data.invalid_count ?? 0),
        invalid_rows: Array.isArray(data.invalid_rows)
          ? data.invalid_rows.map((row: number) => Number(row))
          : [],
        invalid_row_details: mapParticipantImportRowIssues(
          data.invalid_row_details
        ),
        duplicate_row_details: mapParticipantImportRowIssues(
          data.duplicate_row_details
        ),
        participants: createdParticipants,
      };
    },
    [
      addLog,
      applyOnlineOnly,
      getAuthHeaders,
      markParticipantImportBaselineCache,
      setParticipantRecords,
    ]
  );

  const replaceParticipantImport = useCallback(
    async (
      eventId: string,
      csvContent: string,
      mapping: ParticipantImportMappingPayload,
      confirmQrSent = false
    ) => {
      const payload = (
        await applyOnlineOnly(async () =>
          fetchJson(
            `${API_BASE_URL}/events/${eventId}/participant-imports/replace`,
            {
              method: "POST",
              headers: getAuthHeaders(true),
              body: JSON.stringify({
                csv_content: csvContent,
                mapping,
                confirm_qr_sent: confirmQrSent,
              }),
              timeoutMs: 120_000,
            }
          )
        )
      ).payload as { data?: Record<string, unknown> };
      const data = payload.data ?? {};
      const importedParticipants = Array.isArray(data.participants)
        ? data.participants.map((participant: ApiParticipant) =>
            mapApiParticipantToUi(participant, eventId)
          )
        : [];
      setParticipantRecords((previous) => [
        ...previous.filter((participant) => participant.event_id !== eventId),
        ...importedParticipants,
      ]);
      participantFieldMappingsCacheRef.current.delete(eventId);
      participantFieldMappingsStateCacheRef.current.delete(eventId);
      participantFieldMappingsFailureUntilRef.current.delete(eventId);
      addLog(
        `Podmieniono listę uczestników z CSV (${importedParticipants.length} uczestników)`
      );
      await loadBootstrap(true);
      return {
        created_count: Number(data.created_count ?? 0),
        duplicate_count: Number(data.duplicate_count ?? 0),
        invalid_count: Number(data.invalid_count ?? 0),
        invalid_rows: Array.isArray(data.invalid_rows)
          ? data.invalid_rows.map((row: number) => Number(row))
          : [],
        invalid_row_details: mapParticipantImportRowIssues(
          data.invalid_row_details
        ),
        duplicate_row_details: mapParticipantImportRowIssues(
          data.duplicate_row_details
        ),
        participants: importedParticipants,
        reset:
          data.reset && typeof data.reset === "object"
            ? (data.reset as Record<string, unknown>)
            : undefined,
      };
    },
    [
      addLog,
      applyOnlineOnly,
      getAuthHeaders,
      loadBootstrap,
      setParticipantRecords,
    ]
  );

  const resetEventParticipantList = useCallback(
    async (
      eventId: string,
      confirmQrSent = false
    ): Promise<ParticipantListResetResult> => {
      try {
        const offlineError = ensureOnline();
        if (offlineError)
          return {
            ok: false,
            error: offlineError,
            deleted_participant_count: 0,
            deleted_mapping_count: 0,
            deleted_baseline_record_count: 0,
            deleted_change_log_count: 0,
          };
        const payload = (
          await fetchJson(
            `${API_BASE_URL}/events/${eventId}/participant-list`,
            {
              method: "DELETE",
              headers: getAuthHeaders(true),
              body: JSON.stringify({ confirm_qr_sent: confirmQrSent }),
            }
          )
        ).payload as { data?: Record<string, unknown> };
        const data = payload.data ?? {};
        setParticipantRecords((previous) =>
          previous.filter((participant) => participant.event_id !== eventId)
        );
        participantFieldMappingsCacheRef.current.delete(eventId);
        participantFieldMappingsStateCacheRef.current.delete(eventId);
        participantFieldMappingsFailureUntilRef.current.delete(eventId);
        addLog("Usunięto listę uczestników wydarzenia");
        await loadBootstrap(true);
        return {
          ok: true,
          deleted_participant_count: Number(
            data.deleted_participant_count ?? 0
          ),
          deleted_mapping_count: Number(data.deleted_mapping_count ?? 0),
          deleted_baseline_record_count: Number(
            data.deleted_baseline_record_count ?? 0
          ),
          deleted_change_log_count: Number(data.deleted_change_log_count ?? 0),
        };
      } catch (error) {
        handleNetworkFailure(error);
        if (
          isApiResponseError(error) &&
          getApiErrorCode(error) === "qr_emails_sent"
        ) {
          const payload = error.payload as {
            data?: { sent_qr_email_count?: number };
          };
          return {
            ok: false,
            error: error.message,
            qrEmailsSent: true,
            sent_qr_email_count: Number(payload.data?.sent_qr_email_count ?? 0),
            deleted_participant_count: 0,
            deleted_mapping_count: 0,
            deleted_baseline_record_count: 0,
            deleted_change_log_count: 0,
          };
        }
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się usunąć listy uczestników.",
          deleted_participant_count: 0,
          deleted_mapping_count: 0,
          deleted_baseline_record_count: 0,
          deleted_change_log_count: 0,
        };
      }
    },
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      handleNetworkFailure,
      loadBootstrap,
      setParticipantRecords,
    ]
  );

  const getParticipantFieldMappings = useCallback(
    async (eventId: string) => {
      const cachedEntry = participantFieldMappingsCacheRef.current.get(eventId);
      if (
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt <
          PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS
      ) {
        return cachedEntry.mappings;
      }

      const cooldownUntil =
        participantFieldMappingsFailureUntilRef.current.get(eventId) ?? 0;
      if (cooldownUntil > Date.now()) {
        if (cachedEntry) return cachedEntry.mappings;
        throw new Error(
          "Trwa ponowne nawiązywanie połączenia z serwerem. Spróbuj ponownie za chwilę."
        );
      }

      const pendingRequest =
        participantFieldMappingsInFlightRef.current.get(eventId);
      if (pendingRequest) {
        return pendingRequest;
      }

      const request = (async () => {
        try {
          const payload = (
            await applyOnlineOnly(
              async () =>
                fetchJson(
                  `${API_BASE_URL}/events/${eventId}/participant-field-mappings`,
                  { headers: getAuthHeaders() }
                ),
              "Mapowanie pól uczestników jest dostępne tylko po połączeniu z serwerem."
            )
          ).payload as { data?: { mappings?: ParticipantFieldMapping[] } };
          const mappings = payload.data?.mappings ?? [];
          participantFieldMappingsCacheRef.current.set(eventId, {
            fetchedAt: Date.now(),
            mappings,
          });
          participantFieldMappingsFailureUntilRef.current.delete(eventId);
          return mappings;
        } catch (error) {
          if (isNetworkRequestError(error)) {
            participantFieldMappingsFailureUntilRef.current.set(
              eventId,
              Date.now() + PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS
            );
          }
          throw error;
        } finally {
          participantFieldMappingsInFlightRef.current.delete(eventId);
        }
      })();

      participantFieldMappingsInFlightRef.current.set(eventId, request);
      return request;
    },
    [applyOnlineOnly, getAuthHeaders]
  );

  const getParticipantFieldMappingsState = useCallback(
    async (eventId: string): Promise<ParticipantFieldMappingsState> => {
      const cachedEntry =
        participantFieldMappingsStateCacheRef.current.get(eventId);
      if (
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt <
          PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS
      ) {
        return cachedEntry.state;
      }

      const cooldownUntil =
        participantFieldMappingsFailureUntilRef.current.get(eventId) ?? 0;
      if (cooldownUntil > Date.now()) {
        if (cachedEntry) return cachedEntry.state;
        throw new Error(
          "Trwa ponowne nawiązywanie połączenia z serwerem. Spróbuj ponownie za chwilę."
        );
      }

      const pendingRequest =
        participantFieldMappingsStateInFlightRef.current.get(eventId);
      if (pendingRequest) {
        return pendingRequest;
      }

      const request = (async () => {
        try {
          const payload = (
            await applyOnlineOnly(
              async () =>
                fetchJson(
                  `${API_BASE_URL}/events/${eventId}/participant-field-mappings`,
                  { headers: getAuthHeaders() }
                ),
              "Mapowanie pól uczestników jest dostępne tylko po połączeniu z serwerem."
            )
          ).payload as {
            data?: {
              has_mapping?: boolean;
              has_baseline_import?: boolean;
              mappings?: ParticipantFieldMapping[];
            };
          };
          const state = {
            has_mapping: Boolean(payload.data?.has_mapping),
            has_baseline_import: Boolean(payload.data?.has_baseline_import),
            mappings: payload.data?.mappings ?? [],
          };
          participantFieldMappingsStateCacheRef.current.set(eventId, {
            fetchedAt: Date.now(),
            state,
          });
          participantFieldMappingsCacheRef.current.set(eventId, {
            fetchedAt: Date.now(),
            mappings: state.mappings,
          });
          participantFieldMappingsFailureUntilRef.current.delete(eventId);
          return state;
        } catch (error) {
          if (isNetworkRequestError(error)) {
            participantFieldMappingsFailureUntilRef.current.set(
              eventId,
              Date.now() + PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS
            );
          }
          throw error;
        } finally {
          participantFieldMappingsStateInFlightRef.current.delete(eventId);
        }
      })();

      participantFieldMappingsStateInFlightRef.current.set(eventId, request);
      return request;
    },
    [applyOnlineOnly, getAuthHeaders]
  );

  const updateParticipantFieldMappings = useCallback(
    async (
      eventId: string,
      mappings: ParticipantFieldMapping[]
    ): Promise<ParticipantFieldMappingUpdateResult> => {
      try {
        const offlineError = ensureOnline();
        if (offlineError)
          return {
            ok: false,
            error: offlineError,
            mappings: [],
            has_baseline_import: false,
          };

        const payload = (
          await fetchJson(
            `${API_BASE_URL}/events/${eventId}/participant-field-mappings`,
            {
              method: "PATCH",
              headers: getAuthHeaders(true),
              body: JSON.stringify({ mappings }),
            }
          )
        ).payload as {
          data?: {
            has_mapping?: boolean;
            has_baseline_import?: boolean;
            mappings?: ParticipantFieldMapping[];
          };
        };
        const state = {
          has_mapping: Boolean(payload.data?.has_mapping),
          has_baseline_import: Boolean(payload.data?.has_baseline_import),
          mappings: payload.data?.mappings ?? [],
        };
        rememberParticipantFieldMappingsState(eventId, state);
        addLog("Zaktualizowano mapowanie pól uczestników");
        return {
          ok: true,
          mappings: state.mappings,
          has_baseline_import: state.has_baseline_import,
        };
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się zapisać mapowania pól uczestników.",
          mappings: [],
          has_baseline_import: false,
        };
      }
    },
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      handleNetworkFailure,
      rememberParticipantFieldMappingsState,
    ]
  );

  return {
    analyzeParticipantImport,
    confirmParticipantImportMapping,
    runParticipantImport,
    replaceParticipantImport,
    resetEventParticipantList,
    getParticipantFieldMappings,
    getParticipantFieldMappingsState,
    updateParticipantFieldMappings,
    rememberParticipantFieldMappingsState,
    clearParticipantImportCaches,
  };
}
