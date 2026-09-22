import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Event, Organization } from "@/types";
import { API_BASE_URL, fetchJson } from "@/lib/api";
import {
  type ApiOrganization,
  mapApiOrganizationToUi,
} from "@/lib/data-context-helpers";

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

interface OrganizationUpdateInput {
  name?: string;
  event_limit?: number;
}

interface UseOrganizationMutationsArgs {
  organizations: Organization[];
  setOrganizations: Dispatch<SetStateAction<Organization[]>>;
  events: Event[];
  ensureOnline: (message?: string) => string | null;
  runMutation: (
    executor: () => Promise<MutationResult>
  ) => Promise<MutationResult>;
  addLog: (action: string, participantName?: string) => void;
  markLocalDataChanged: () => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  loadBootstrap: (silent?: boolean) => Promise<void>;
}

export function useOrganizationMutations({
  organizations,
  setOrganizations,
  events,
  ensureOnline,
  runMutation,
  addLog,
  markLocalDataChanged,
  getAuthHeaders,
  loadBootstrap,
}: UseOrganizationMutationsArgs) {
  const createOrganization = useCallback(
    async (data: { name: string; event_limit: number }) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/organizations`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify(data),
          })
        ).payload as { data?: ApiOrganization };
        if (!payload.data)
          return {
            ok: false,
            error: "API organization create returned empty payload",
          };
        const createdOrganization = mapApiOrganizationToUi(payload.data);
        markLocalDataChanged();
        setOrganizations((previous) => [...previous, createdOrganization]);
        return { ok: true, entityId: createdOrganization.id };
      }),
    [
      ensureOnline,
      getAuthHeaders,
      markLocalDataChanged,
      runMutation,
      setOrganizations,
    ]
  );

  const updateOrganization = useCallback(
    async (organizationId: string, data: OrganizationUpdateInput) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/organizations/${organizationId}`, {
            method: "PATCH",
            headers: getAuthHeaders(true),
            body: JSON.stringify(data),
          })
        ).payload as { data?: ApiOrganization };
        if (!payload.data)
          return {
            ok: false,
            error: "API organization update returned empty payload",
          };
        const updatedOrganization = mapApiOrganizationToUi(payload.data);
        setOrganizations((previous) =>
          previous.map((organization) =>
            organization.id === organizationId
              ? updatedOrganization
              : organization
          )
        );
        if (data.name)
          addLog(`Zaktualizowano organizację: ${updatedOrganization.name}`);
        return { ok: true };
      }),
    [addLog, ensureOnline, getAuthHeaders, runMutation, setOrganizations]
  );

  const updateOrganizationEventLimit = useCallback(
    async (organizationId: string, eventLimit: number) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const assignedEventsCount = events.filter(
          (event) => event.organization_id === organizationId
        ).length;
        if (eventLimit < assignedEventsCount)
          return {
            ok: false,
            error: `Limit wydarzeń nie może być mniejszy niż ${assignedEventsCount}, bo tyle wydarzeń jest już przypisanych do tej organizacji.`,
          };
        const payload = (
          await fetchJson(
            `${API_BASE_URL}/organizations/${organizationId}/event-limit`,
            {
              method: "POST",
              headers: getAuthHeaders(true),
              body: JSON.stringify({ event_limit: eventLimit }),
            }
          )
        ).payload as { data?: ApiOrganization };
        if (!payload.data)
          return {
            ok: false,
            error: "API organization update returned empty payload",
          };
        const updatedOrganization = mapApiOrganizationToUi(payload.data);
        setOrganizations((previous) =>
          previous.map((organization) =>
            organization.id === organizationId
              ? updatedOrganization
              : organization
          )
        );
        await loadBootstrap(true);
        return { ok: true };
      }),
    [
      ensureOnline,
      events,
      getAuthHeaders,
      loadBootstrap,
      runMutation,
      setOrganizations,
    ]
  );

  const deleteOrganization = useCallback(
    async (organizationId: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingOrganization = organizations.find(
          (organization) => organization.id === organizationId
        );
        await fetchJson(`${API_BASE_URL}/organizations/${organizationId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        setOrganizations((previous) =>
          previous.filter((organization) => organization.id !== organizationId)
        );
        if (existingOrganization)
          addLog(`Usunięto organizację: ${existingOrganization.name}`);
        return { ok: true };
      }),
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      organizations,
      runMutation,
      setOrganizations,
    ]
  );

  return {
    createOrganization,
    updateOrganization,
    updateOrganizationEventLimit,
    deleteOrganization,
  };
}
