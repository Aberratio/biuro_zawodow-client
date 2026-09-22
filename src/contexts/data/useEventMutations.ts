import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Event,
  Organization,
  Participant,
  ParticipantFieldMapping,
} from "@/types";
import { API_BASE_URL, fetchJson } from "@/lib/api";
import {
  type ApiEvent,
  type ApiParticipant,
  mapApiEventToUi,
  mapApiParticipantToUi,
} from "@/lib/data-context-helpers";
import { getEventOfficeCloseAt } from "@/lib/events";
import { buildExportFallbackName, downloadCsvResponse } from "@/lib/csv-export";
import type { ParticipantFieldMappingsState } from "@/contexts/data/useParticipantImport";

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

type EventMutationInput = Omit<
  Event,
  | "id"
  | "archived_at"
  | "deleted_at"
  | "is_test"
  | "office_open_at"
  | "office_close_at"
>;
type EventUpdateInput = EventMutationInput & { reopen_office?: boolean };

interface UseEventMutationsArgs {
  organizations: Organization[];
  events: Event[];
  setEvents: Dispatch<SetStateAction<Event[]>>;
  archivedEvents: Event[];
  setArchivedEvents: Dispatch<SetStateAction<Event[]>>;
  setParticipantRecords: Dispatch<SetStateAction<Participant[]>>;
  selectedEventId: string;
  setSelectedEventId: (eventId: string) => void;
  ensureOnline: (message?: string) => string | null;
  runMutation: (
    executor: () => Promise<MutationResult>
  ) => Promise<MutationResult>;
  addLog: (action: string, participantName?: string) => void;
  markLocalDataChanged: () => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  loadBootstrap: (silent?: boolean) => Promise<void>;
  handleNetworkFailure: (
    error: unknown,
    options?: { immediate?: boolean }
  ) => void;
  rememberParticipantFieldMappingsState: (
    eventId: string,
    state: ParticipantFieldMappingsState
  ) => void;
}

export function useEventMutations({
  organizations,
  events,
  setEvents,
  archivedEvents,
  setArchivedEvents,
  setParticipantRecords,
  selectedEventId,
  setSelectedEventId,
  ensureOnline,
  runMutation,
  addLog,
  markLocalDataChanged,
  getAuthHeaders,
  loadBootstrap,
  handleNetworkFailure,
  rememberParticipantFieldMappingsState,
}: UseEventMutationsArgs) {
  const createEvent = useCallback(
    async (eventData: EventMutationInput) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const organization = organizations.find(
          (entry) => entry.id === eventData.organization_id
        );
        const organizationEventCount = [...events, ...archivedEvents].filter(
          (event) =>
            event.organization_id === eventData.organization_id &&
            !event.is_test
        ).length;
        if (organization && organizationEventCount >= organization.event_limit)
          return {
            ok: false,
            error: "Limit wydarzeń dla tej organizacji został osiągnięty",
          };
        const payload = (
          await fetchJson(`${API_BASE_URL}/events`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify(eventData),
          })
        ).payload as { data?: ApiEvent };
        if (!payload.data)
          return {
            ok: false,
            error: "API zwróciło pustą odpowiedź podczas tworzenia wydarzenia",
          };
        const createdEvent = mapApiEventToUi(payload.data);
        markLocalDataChanged();
        setEvents((previous) => [...previous, createdEvent]);
        addLog(`Utworzono wydarzenie: ${createdEvent.name}`);
        return { ok: true, entityId: createdEvent.id };
      }),
    [
      addLog,
      archivedEvents,
      ensureOnline,
      events,
      getAuthHeaders,
      markLocalDataChanged,
      organizations,
      runMutation,
      setEvents,
    ]
  );

  const createTestEvent = useCallback(
    async (organizationId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/events/test`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({ organization_id: organizationId }),
          })
        ).payload as {
          data?: {
            event?: ApiEvent;
            participants?: ApiParticipant[];
            mappings?: ParticipantFieldMapping[];
          };
        };
        const event = payload.data?.event;
        if (!event)
          return {
            ok: false,
            error:
              "API zwrocilo pusta odpowiedz podczas tworzenia wydarzenia testowego",
          };
        const createdEvent = mapApiEventToUi(event);
        const createdParticipants = (payload.data?.participants ?? []).map(
          (participant) => mapApiParticipantToUi(participant, createdEvent.id)
        );
        markLocalDataChanged();
        setEvents((previous) => [
          ...previous.filter((item) => item.id !== createdEvent.id),
          createdEvent,
        ]);
        setParticipantRecords((previous) => [
          ...previous.filter(
            (participant) => participant.event_id !== createdEvent.id
          ),
          ...createdParticipants,
        ]);
        if (Array.isArray(payload.data?.mappings)) {
          rememberParticipantFieldMappingsState(createdEvent.id, {
            has_mapping: payload.data.mappings.length > 0,
            has_baseline_import: true,
            mappings: payload.data.mappings,
          });
        }
        addLog(`Utworzono wydarzenie testowe: ${createdEvent.name}`);
        await loadBootstrap(true);
        return { ok: true, entityId: createdEvent.id };
      }),
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      loadBootstrap,
      markLocalDataChanged,
      rememberParticipantFieldMappingsState,
      runMutation,
      setEvents,
      setParticipantRecords,
    ]
  );

  const resetTestEvent = useCallback(
    async (eventId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/events/${eventId}/test-reset`, {
            method: "POST",
            headers: getAuthHeaders(),
          })
        ).payload as {
          data?: {
            event?: ApiEvent;
            participants?: ApiParticipant[];
            mappings?: ParticipantFieldMapping[];
          };
        };
        const event = payload.data?.event;
        if (!event)
          return {
            ok: false,
            error:
              "API zwrocilo pusta odpowiedz podczas resetu wydarzenia testowego",
          };
        const resetEvent = mapApiEventToUi(event);
        const resetParticipants = (payload.data?.participants ?? []).map(
          (participant) => mapApiParticipantToUi(participant, resetEvent.id)
        );
        markLocalDataChanged();
        setEvents((previous) => [
          ...previous.filter((item) => item.id !== resetEvent.id),
          resetEvent,
        ]);
        setArchivedEvents((previous) =>
          previous.filter((item) => item.id !== resetEvent.id)
        );
        setParticipantRecords((previous) => [
          ...previous.filter(
            (participant) => participant.event_id !== resetEvent.id
          ),
          ...resetParticipants,
        ]);
        if (Array.isArray(payload.data?.mappings)) {
          rememberParticipantFieldMappingsState(resetEvent.id, {
            has_mapping: payload.data.mappings.length > 0,
            has_baseline_import: true,
            mappings: payload.data.mappings,
          });
        }
        addLog(`Zresetowano wydarzenie testowe: ${resetEvent.name}`);
        await loadBootstrap(true);
        return { ok: true, entityId: resetEvent.id };
      }),
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      loadBootstrap,
      markLocalDataChanged,
      rememberParticipantFieldMappingsState,
      runMutation,
      setArchivedEvents,
      setEvents,
      setParticipantRecords,
    ]
  );

  const updateEvent = useCallback(
    async (eventId: string, data: EventUpdateInput) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/events/${eventId}`, {
            method: "PATCH",
            headers: getAuthHeaders(true),
            body: JSON.stringify(data),
          })
        ).payload as { data?: ApiEvent };
        if (!payload.data)
          return {
            ok: false,
            error:
              "API zwróciło pustą odpowiedź podczas aktualizacji wydarzenia",
          };
        const updatedEvent = mapApiEventToUi(payload.data);
        markLocalDataChanged();
        setEvents((previous) =>
          previous.map((event) => (event.id === eventId ? updatedEvent : event))
        );
        addLog(`Zaktualizowano wydarzenie: ${updatedEvent.name}`);
        return { ok: true };
      }),
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      markLocalDataChanged,
      runMutation,
      setEvents,
    ]
  );

  const archiveEvent = useCallback(
    async (eventId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingEvent = events.find((event) => event.id === eventId);
        const eventOfficeCloseAt = existingEvent
          ? getEventOfficeCloseAt(existingEvent)
          : null;
        if (
          eventOfficeCloseAt === null ||
          Date.now() <= eventOfficeCloseAt.getTime()
        )
          return {
            ok: false,
            error: "Do archiwum można przenieść tylko zakończone wydarzenia",
          };
        await fetchJson(`${API_BASE_URL}/events/${eventId}/archive`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        markLocalDataChanged();
        setEvents((previous) =>
          previous.filter((event) => event.id !== eventId)
        );
        if (existingEvent)
          setArchivedEvents((previous) => [
            { ...existingEvent, archived_at: new Date().toISOString() },
            ...previous,
          ]);
        if (selectedEventId === eventId) setSelectedEventId("");
        if (existingEvent)
          addLog(`Zarchiwizowano wydarzenie: ${existingEvent.name}`);
        await loadBootstrap(true);
        return { ok: true };
      }),
    [
      addLog,
      ensureOnline,
      events,
      getAuthHeaders,
      loadBootstrap,
      markLocalDataChanged,
      runMutation,
      selectedEventId,
      setArchivedEvents,
      setEvents,
      setSelectedEventId,
    ]
  );

  const deleteEvent = useCallback(
    async (eventId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingEvent = events.find((event) => event.id === eventId);
        const eventOfficeCloseAt = existingEvent
          ? getEventOfficeCloseAt(existingEvent)
          : null;
        if (
          eventOfficeCloseAt !== null &&
          Date.now() > eventOfficeCloseAt.getTime() &&
          !existingEvent?.is_test
        )
          return {
            ok: false,
            error:
              "Zakończone wydarzenia trzeba przenieść do archiwum zamiast usuwać",
          };
        await fetchJson(`${API_BASE_URL}/events/${eventId}/delete-ui`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        markLocalDataChanged();
        setEvents((previous) =>
          previous.filter((event) => event.id !== eventId)
        );
        if (selectedEventId === eventId) setSelectedEventId("");
        if (existingEvent) addLog(`Usunięto wydarzenie: ${existingEvent.name}`);
        await loadBootstrap(true);
        return { ok: true };
      }),
    [
      addLog,
      ensureOnline,
      events,
      getAuthHeaders,
      loadBootstrap,
      markLocalDataChanged,
      runMutation,
      selectedEventId,
      setEvents,
      setSelectedEventId,
    ]
  );

  const exportEventCsv = useCallback(
    async (eventId: string): Promise<MutationResult> => {
      const offlineError = ensureOnline();
      if (offlineError) return { ok: false, error: offlineError };
      try {
        const response = await fetch(
          `${API_BASE_URL}/events/${eventId}/export.csv`,
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
              `Eksport wydarzenia nie powiódł się: ${response.status}`,
          };
        }
        await downloadCsvResponse(
          response,
          buildExportFallbackName(events, archivedEvents, eventId, "uczestnicy")
        );
        return { ok: true };
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się wyeksportować CSV",
        };
      }
    },
    [archivedEvents, ensureOnline, events, getAuthHeaders, handleNetworkFailure]
  );

  const exportEventLogsCsv = useCallback(
    async (eventId: string): Promise<MutationResult> => {
      const offlineError = ensureOnline();
      if (offlineError) return { ok: false, error: offlineError };
      try {
        const response = await fetch(
          `${API_BASE_URL}/events/${eventId}/logs/export.csv`,
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
              `Eksport logów wydarzenia nie powiódł się: ${response.status}`,
          };
        }
        await downloadCsvResponse(
          response,
          buildExportFallbackName(events, archivedEvents, eventId, "logi")
        );
        return { ok: true };
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Nie udało się wyeksportować logów CSV",
        };
      }
    },
    [archivedEvents, ensureOnline, events, getAuthHeaders, handleNetworkFailure]
  );

  return {
    createEvent,
    createTestEvent,
    resetTestEvent,
    updateEvent,
    archiveEvent,
    deleteEvent,
    exportEventCsv,
    exportEventLogsCsv,
  };
}
