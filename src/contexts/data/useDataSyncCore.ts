import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivityLog,
  AppDiagnostics,
  ConnectionState,
  Event,
  Organization,
  Participant,
  ServiceWorkerState,
  SnapshotSource,
  User,
} from "@/types";
import {
  API_BASE_URL,
  fetchJson,
  isApiResponseError,
  isNetworkRequestError,
} from "@/lib/api";
import {
  type BootstrapResponse,
  OFFLINE_ACTION_MESSAGE,
  buildOfflineSnapshot,
  createBootstrapSnapshotVersion,
  getDefaultCurrentUser,
  getInitialConnectionState,
  getSelectableOrganizationsForUser,
  getVisibleEventsForUser,
  mapApiEventToUi,
  mapApiOrganizationToUi,
  mapApiParticipantToUi,
  mapApiUserToUi,
  persistStoredSelectedEventId,
  persistStoredSelectedOrganizationId,
  readStoredSelectedEventId,
  readStoredSelectedOrganizationId,
  resolveSelectedEventId,
  resolveSelectedOrganizationId,
} from "@/lib/data-context-helpers";
import {
  loadBootstrapSnapshot,
  loadSyncMeta,
  saveBootstrapSnapshot,
  saveSyncMeta,
  type OfflineBootstrapSnapshot,
} from "@/lib/offline-store";
import { isEventOfficeOpen } from "@/lib/events";
import { hasGlobalOrganizationScope } from "@/lib/roles";
import { checkBrowserStorage } from "@/lib/browser-storage";

const CONNECTION_RECOVERY_INTERVAL_MS = 15_000;
const NETWORK_FAILURE_THRESHOLD = 2;
const INITIAL_DIAGNOSTICS: AppDiagnostics = {
  sessionStorageAvailable: true,
  localStorageAvailable: true,
  indexedDbAvailable: true,
  canPersistSession: true,
  serviceWorkerState: "checking",
  warnings: [],
};

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

interface UseDataSyncCoreArgs {
  authUser: User | null;
  token: string | null;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  clearSession: () => void;
}

export function useDataSyncCore({
  authUser,
  token,
  getAuthHeaders,
  clearSession,
}: UseDataSyncCoreArgs) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<Event[]>([]);
  const [participantRecords, setParticipantRecords] = useState<Participant[]>(
    []
  );
  const [users, setUsers] = useState<User[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState("");
  const [selectedEventId, setSelectedEventIdState] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    getInitialConnectionState
  );
  const [snapshotSource, setSnapshotSource] = useState<SnapshotSource>("none");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [offlineSinceAt, setOfflineSinceAt] = useState<string | null>(() =>
    getInitialConnectionState() === "offline" ? new Date().toISOString() : null
  );
  const [diagnostics, setDiagnostics] =
    useState<AppDiagnostics>(INITIAL_DIAGNOSTICS);
  const networkFailureCountRef = useRef(0);
  const localDataRevisionRef = useRef(0);
  // Set by DataProvider once useParticipantImport() is called (that hook needs
  // several callbacks returned from this one, so it's wired up after this
  // hook runs). resetState() reads it indirectly through this ref so the two
  // hooks can be composed without a circular dependency.
  const clearParticipantImportCachesRef = useRef<() => void>(() => {});

  const currentUser = useMemo(
    () =>
      !authUser
        ? getDefaultCurrentUser()
        : users.find((user) => user.id === authUser.id) || authUser,
    [users, authUser]
  );
  const currentRole = currentUser.role;
  const usesOrganizationContext = hasGlobalOrganizationScope(currentRole);
  const visibleEvents = useMemo(
    () => getVisibleEventsForUser(events, currentUser, new Date(nowTimestamp)),
    [events, currentUser, nowTimestamp]
  );
  const selectableOrganizations = useMemo(
    () => getSelectableOrganizationsForUser(organizations, currentUser),
    [organizations, currentUser]
  );
  const eventSelectionScope = useMemo(
    () =>
      usesOrganizationContext && selectedOrganizationId
        ? visibleEvents.filter(
            (event) => event.organization_id === selectedOrganizationId
          )
        : visibleEvents,
    [selectedOrganizationId, usesOrganizationContext, visibleEvents]
  );
  const offlineDurationMs = useMemo(
    () =>
      !offlineSinceAt
        ? 0
        : Math.max(0, nowTimestamp - new Date(offlineSinceAt).getTime()),
    [nowTimestamp, offlineSinceAt]
  );

  const persistSelectedOrganizationId = useCallback(
    (organizationId: string, userId?: string | null) => {
      if (!userId) return;
      persistStoredSelectedOrganizationId(userId, organizationId);
    },
    []
  );

  const setSelectedOrganizationId = useCallback(
    (organizationId: string) => {
      setSelectedOrganizationIdState(organizationId);
      persistSelectedOrganizationId(organizationId, authUser?.id);
    },
    [authUser?.id, persistSelectedOrganizationId]
  );

  const persistSelectedEventId = useCallback(
    (eventId: string, userId?: string | null) => {
      if (!userId) return;
      persistStoredSelectedEventId(userId, eventId);
    },
    []
  );

  const setSelectedEventId = useCallback(
    (eventId: string) => {
      setSelectedEventIdState(eventId);
      persistSelectedEventId(eventId, authUser?.id);
    },
    [authUser?.id, persistSelectedEventId]
  );

  const selectEventContext = useCallback(
    (eventId: string) => {
      const nextEventId = eventId.trim();
      const nextEvent =
        visibleEvents.find((event) => event.id === nextEventId) ??
        events.find((event) => event.id === nextEventId);

      if (hasGlobalOrganizationScope(currentRole)) {
        const nextOrganizationId = nextEvent?.organization_id ?? "";
        if (nextOrganizationId !== selectedOrganizationId) {
          setSelectedOrganizationIdState(nextOrganizationId);
          persistSelectedOrganizationId(nextOrganizationId, authUser?.id);
        }
      }

      setSelectedEventIdState(nextEventId);
      persistSelectedEventId(nextEventId, authUser?.id);
    },
    [
      authUser?.id,
      currentRole,
      events,
      persistSelectedEventId,
      persistSelectedOrganizationId,
      selectedOrganizationId,
      visibleEvents,
    ]
  );

  const syncStoredAuthUser = useCallback((updater: (user: User) => User) => {
    try {
      const raw =
        sessionStorage.getItem("auth_user") ??
        localStorage.getItem("auth_user");
      if (!raw) return;

      const nextValue = JSON.stringify(updater(JSON.parse(raw) as User));
      sessionStorage.setItem("auth_user", nextValue);
      localStorage.setItem("auth_user", nextValue);
    } catch {
      // Ignore storage sync failures and keep the in-memory session usable.
    }
  }, []);

  const resetState = useCallback(() => {
    setOrganizations([]);
    setEvents([]);
    setArchivedEvents([]);
    setParticipantRecords([]);
    setUsers([]);
    setActivityLog([]);
    setSelectedOrganizationIdState("");
    setSelectedEventIdState("");
    setSnapshotSource("none");
    setLastSyncAt(null);
    clearParticipantImportCachesRef.current();
    networkFailureCountRef.current = 0;
  }, []);

  const markConnectionHealthy = useCallback(() => {
    networkFailureCountRef.current = 0;
    setConnectionState("online");
    setOfflineSinceAt(null);
  }, []);

  const setDegradedState = useCallback((source?: SnapshotSource) => {
    setConnectionState(
      typeof navigator !== "undefined" && navigator.onLine
        ? "degraded"
        : "offline"
    );
    setOfflineSinceAt((previous) => previous ?? new Date().toISOString());
    if (source) {
      setSnapshotSource(source);
    }
  }, []);

  const ensureOnline = useCallback(
    (message = OFFLINE_ACTION_MESSAGE) =>
      connectionState === "online" ? null : message,
    [connectionState]
  );
  const markLocalDataChanged = useCallback(() => {
    localDataRevisionRef.current += 1;
  }, []);
  const handleNetworkFailure = useCallback(
    (error: unknown, options?: { immediate?: boolean }) => {
      if (!isNetworkRequestError(error)) return;
      networkFailureCountRef.current += 1;
      if (
        options?.immediate ||
        networkFailureCountRef.current >= NETWORK_FAILURE_THRESHOLD
      ) {
        setDegradedState();
      }
    },
    [setDegradedState]
  );
  const addLog = useCallback(
    (action: string, participantName?: string) =>
      setActivityLog((previous) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action,
          participant_name: participantName,
          user_name: currentUser.name,
        },
        ...previous,
      ]),
    [currentUser.name]
  );

  const updateSyncMeta = useCallback(
    async (
      userId: string,
      nextLastSyncAt: string | null,
      nextOfflineSinceAt: string | null
    ) => {
      try {
        await saveSyncMeta({
          key: `${API_BASE_URL}::${userId}`,
          apiBaseUrl: API_BASE_URL,
          userId,
          lastSyncAt: nextLastSyncAt,
          offlineSinceAt: nextOfflineSinceAt,
        });
      } catch {
        // Sync metadata is a best-effort cache; storage failures must not break callers.
      }
    },
    []
  );

  const applyOnlineOnly = useCallback(
    async <T>(executor: () => Promise<T>, offlineMessage?: string) => {
      const offlineError = ensureOnline(offlineMessage);
      if (offlineError) throw new Error(offlineError);
      try {
        const result = await executor();
        markConnectionHealthy();
        return result;
      } catch (error) {
        handleNetworkFailure(error);
        throw error;
      }
    },
    [ensureOnline, handleNetworkFailure, markConnectionHealthy]
  );

  const runMutation = useCallback(
    async (
      executor: () => Promise<MutationResult>
    ): Promise<MutationResult> => {
      try {
        const result = await executor();
        markConnectionHealthy();
        return result;
      } catch (error) {
        handleNetworkFailure(error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Wystąpił błąd.",
        };
      }
    },
    [handleNetworkFailure, markConnectionHealthy]
  );

  const hydrateData = useCallback(
    (
      responseData:
        BootstrapResponse["data"] | OfflineBootstrapSnapshot["data"],
      source: SnapshotSource,
      generatedAt: string,
      preferredOrganizationId = "",
      preferredEventId = ""
    ) => {
      if (!authUser) return;
      const nextOrganizations = Array.isArray(responseData.organizations)
        ? responseData.organizations.map(mapApiOrganizationToUi)
        : [];
      const nextEvents = Array.isArray(responseData.events)
        ? responseData.events.map(mapApiEventToUi)
        : [];
      const nextArchivedEvents = Array.isArray(responseData.archivedEvents)
        ? responseData.archivedEvents.map(mapApiEventToUi)
        : [];
      const nextUsers = (responseData.users ?? []).map(mapApiUserToUi);
      const nextCurrentUser =
        nextUsers.find((user) => user.id === authUser.id) ?? authUser;
      const nextVisibleEvents = getVisibleEventsForUser(
        nextEvents,
        nextCurrentUser
      );
      const nextSelectableOrganizations = getSelectableOrganizationsForUser(
        nextOrganizations,
        nextCurrentUser
      );
      const preferredOrg =
        readStoredSelectedOrganizationId(authUser.id) ||
        preferredOrganizationId;
      const nextUsesOrganizationContext = hasGlobalOrganizationScope(
        nextCurrentUser.role
      );
      const nextSelectedOrganization = nextUsesOrganizationContext
        ? resolveSelectedOrganizationId(
            nextSelectableOrganizations,
            preferredOrg
          )
        : "";
      const scopedEvents =
        nextUsesOrganizationContext && nextSelectedOrganization
          ? nextVisibleEvents.filter(
              (event) => event.organization_id === nextSelectedOrganization
            )
          : nextVisibleEvents;
      const preferredEvt =
        readStoredSelectedEventId(authUser.id) || preferredEventId;
      const nextSelectedEvent = resolveSelectedEventId(
        scopedEvents,
        preferredEvt
      );
      const nextParticipants = (responseData.participants ?? []).map(
        (participant) => mapApiParticipantToUi(participant, "")
      );
      setOrganizations(nextOrganizations);
      setEvents(nextEvents);
      setArchivedEvents(nextArchivedEvents);
      setUsers(nextUsers);
      setParticipantRecords(nextParticipants);
      setActivityLog(
        Array.isArray(responseData.activityLog) ? responseData.activityLog : []
      );
      setSelectedOrganizationIdState(nextSelectedOrganization);
      setSelectedEventIdState(nextSelectedEvent);
      persistSelectedOrganizationId(nextSelectedOrganization, authUser.id);
      persistSelectedEventId(nextSelectedEvent, authUser.id);
      setSnapshotSource(source);
      setLastSyncAt(generatedAt);
    },
    [authUser, persistSelectedEventId, persistSelectedOrganizationId]
  );

  const restoreCachedBootstrap = useCallback(async () => {
    if (!authUser?.id) return false;
    const snapshot = await loadBootstrapSnapshot(API_BASE_URL, authUser.id);
    if (!snapshot) return false;
    hydrateData(
      snapshot.data,
      "cache",
      snapshot.savedAt,
      snapshot.selectedOrganizationId,
      snapshot.selectedEventId
    );
    setDegradedState("cache");
    return true;
  }, [authUser?.id, hydrateData, setDegradedState]);

  const loadBootstrap = useCallback(
    async (silent = false) => {
      const requestRevision = localDataRevisionRef.current;
      if (!silent) setIsLoading(true);
      if (!authUser || !token) {
        resetState();
        setIsLoading(false);
        return;
      }
      try {
        const { payload } = await fetchJson(`${API_BASE_URL}/bootstrap`, {
          headers: getAuthHeaders(),
        });
        const response = payload as BootstrapResponse;
        if (requestRevision !== localDataRevisionRef.current) {
          markConnectionHealthy();
          return;
        }
        const generatedAt = response.generated_at ?? new Date().toISOString();
        const snapshotVersion =
          response.snapshot_version ??
          createBootstrapSnapshotVersion(response.data);
        hydrateData(response.data, "network", generatedAt);
        markConnectionHealthy();
        try {
          await saveBootstrapSnapshot(
            buildOfflineSnapshot({
              userId: authUser.id,
              selectedOrganizationId: readStoredSelectedOrganizationId(
                authUser.id
              ),
              selectedEventId: readStoredSelectedEventId(authUser.id),
              organizations: Array.isArray(response.data.organizations)
                ? response.data.organizations.map(mapApiOrganizationToUi)
                : [],
              events: Array.isArray(response.data.events)
                ? response.data.events.map(mapApiEventToUi)
                : [],
              archivedEvents: Array.isArray(response.data.archivedEvents)
                ? response.data.archivedEvents.map(mapApiEventToUi)
                : [],
              users: (response.data.users ?? []).map(mapApiUserToUi),
              participants: (response.data.participants ?? []).map(
                (participant) => mapApiParticipantToUi(participant, "")
              ),
              activityLog: Array.isArray(response.data.activityLog)
                ? response.data.activityLog
                : [],
              generatedAt,
              snapshotVersion,
            })
          );
          await updateSyncMeta(authUser.id, generatedAt, null);
        } catch {
          // The bootstrap itself succeeded; a failed offline-cache write must not push the app into degraded mode.
        }
      } catch (error) {
        if (requestRevision !== localDataRevisionRef.current) return;
        if (isApiResponseError(error) && error.status === 401) {
          clearSession();
          resetState();
        } else if (!(await restoreCachedBootstrap())) {
          if (isNetworkRequestError(error)) {
            handleNetworkFailure(error, { immediate: true });
          } else {
            setDegradedState();
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      authUser,
      clearSession,
      getAuthHeaders,
      handleNetworkFailure,
      hydrateData,
      markConnectionHealthy,
      resetState,
      restoreCachedBootstrap,
      setDegradedState,
      token,
      updateSyncMeta,
    ]
  );

  const refreshData = useCallback(
    async (silent = false) => {
      await loadBootstrap(silent);
    },
    [loadBootstrap]
  );

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);
  useEffect(() => {
    let mounted = true;

    const refreshStorageDiagnostics = async () => {
      try {
        const storage = await checkBrowserStorage();
        if (!mounted) return;
        setDiagnostics((previous) => ({
          ...previous,
          sessionStorageAvailable: storage.sessionStorageAvailable,
          localStorageAvailable: storage.localStorageAvailable,
          indexedDbAvailable: storage.indexedDbAvailable,
          canPersistSession: storage.canPersistSession,
          warnings: storage.warnings,
        }));
      } catch {
        if (!mounted) return;
        setDiagnostics((previous) => ({
          ...previous,
          indexedDbAvailable: false,
          warnings: Array.from(
            new Set([
              ...previous.warnings,
              "Nie udało się sprawdzić pamięci offline aplikacji. Tryb offline może być niedostępny.",
            ])
          ),
        }));
      }
    };

    void refreshStorageDiagnostics();
    window.addEventListener("focus", refreshStorageDiagnostics);

    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshStorageDiagnostics);
    };
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setDiagnostics((previous) => ({
        ...previous,
        serviceWorkerState: "unsupported",
      }));
      return undefined;
    }

    let mounted = true;

    const setServiceWorkerState = (serviceWorkerState: ServiceWorkerState) => {
      if (mounted) {
        setDiagnostics((previous) => ({ ...previous, serviceWorkerState }));
      }
    };

    const refreshServiceWorkerState = async () => {
      if (!import.meta.env.PROD) {
        setServiceWorkerState("ready");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration(
          import.meta.env.BASE_URL
        );
        setServiceWorkerState(registration ? "ready" : "unavailable");
      } catch {
        setServiceWorkerState("unavailable");
      }
    };

    const handleReady = () => setServiceWorkerState("ready");
    const handleUnavailable = () => setServiceWorkerState("unavailable");

    window.addEventListener("biuro-zawodow:service-worker-ready", handleReady);
    window.addEventListener(
      "biuro-zawodow:service-worker-unavailable",
      handleUnavailable
    );
    void refreshServiceWorkerState();

    return () => {
      mounted = false;
      window.removeEventListener(
        "biuro-zawodow:service-worker-ready",
        handleReady
      );
      window.removeEventListener(
        "biuro-zawodow:service-worker-unavailable",
        handleUnavailable
      );
    };
  }, []);
  useEffect(() => {
    if (!authUser?.id) {
      setSnapshotSource("none");
      setLastSyncAt(null);
      return;
    }
    setSelectedOrganizationIdState(
      readStoredSelectedOrganizationId(authUser.id)
    );
    setSelectedEventIdState(readStoredSelectedEventId(authUser.id));
    void loadSyncMeta(API_BASE_URL, authUser.id)
      .then((meta) => {
        if (!meta) return;
        setLastSyncAt(meta.lastSyncAt);
        setOfflineSinceAt(meta.offlineSinceAt);
      })
      .catch(() => undefined);
  }, [authUser?.id]);
  useEffect(() => {
    const intervalId = window.setInterval(
      () => setNowTimestamp(Date.now()),
      30_000
    );
    return () => window.clearInterval(intervalId);
  }, []);
  useEffect(() => {
    const handleOnline = () => {
      setConnectionState((previous) =>
        previous === "online" ? "online" : "degraded"
      );
      void loadBootstrap(true);
    };
    const handleOffline = () => {
      setConnectionState("offline");
      setOfflineSinceAt((previous) => previous ?? new Date().toISOString());
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadBootstrap]);
  useEffect(() => {
    if (!authUser?.id || !token || connectionState === "online")
      return undefined;
    const intervalId = window.setInterval(() => {
      void loadBootstrap(true);
    }, CONNECTION_RECOVERY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [authUser?.id, connectionState, loadBootstrap, token]);
  useEffect(() => {
    if (authUser?.id)
      void updateSyncMeta(authUser.id, lastSyncAt, offlineSinceAt);
  }, [authUser?.id, lastSyncAt, offlineSinceAt, updateSyncMeta]);
  useEffect(() => {
    if (!usesOrganizationContext) {
      if (selectedOrganizationId !== "") setSelectedOrganizationId("");
      return;
    }

    if (isLoading) return;

    const nextSelectedOrganizationId = resolveSelectedOrganizationId(
      selectableOrganizations,
      selectedOrganizationId
    );
    if (nextSelectedOrganizationId !== selectedOrganizationId)
      setSelectedOrganizationId(nextSelectedOrganizationId);
  }, [
    isLoading,
    selectableOrganizations,
    selectedOrganizationId,
    setSelectedOrganizationId,
    usesOrganizationContext,
  ]);
  useEffect(() => {
    if (isLoading) return;

    const nextVisibleEventId = eventSelectionScope[0]?.id ?? "";
    if (
      eventSelectionScope.some((event) => event.id === selectedEventId) ||
      nextVisibleEventId === selectedEventId
    )
      return;
    setSelectedEventId(nextVisibleEventId);
  }, [eventSelectionScope, isLoading, selectedEventId, setSelectedEventId]);

  const canAccessEvent = useCallback(
    (eventId: string) => {
      const event =
        events.find((entry) => entry.id === eventId) ??
        archivedEvents.find((entry) => entry.id === eventId);
      if (!event) return false;
      if (event.deleted_at) return false;
      if (event.archived_at) return currentRole === "superadmin";
      if (currentRole === "superadmin" || currentRole === "admin") return true;
      if (currentRole === "editor")
        return event.organization_id === currentUser.organization_id;
      return (
        currentUser.assigned_events.includes(eventId) &&
        isEventOfficeOpen(event, new Date(nowTimestamp))
      );
    },
    [archivedEvents, currentRole, currentUser, events, nowTimestamp]
  );

  const canViewEvent = useCallback(
    (eventId: string) => {
      if (canAccessEvent(eventId)) return true;
      const event = archivedEvents.find((entry) => entry.id === eventId);
      if (!event) return false;
      if (currentRole === "admin") return true;
      if (currentRole === "editor")
        return event.organization_id === currentUser.organization_id;
      return false;
    },
    [archivedEvents, canAccessEvent, currentRole, currentUser]
  );

  return {
    organizations,
    setOrganizations,
    events,
    setEvents,
    archivedEvents,
    setArchivedEvents,
    participantRecords,
    setParticipantRecords,
    users,
    setUsers,
    activityLog,
    currentUser,
    currentRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedEventId,
    setSelectedEventId,
    selectEventContext,
    visibleEvents,
    canAccessEvent,
    canViewEvent,
    isLoading,
    connectionState,
    diagnostics,
    snapshotSource,
    lastSyncAt,
    setLastSyncAt,
    offlineDurationMs,
    hydrateData,
    loadBootstrap,
    restoreCachedBootstrap,
    refreshData,
    resetState,
    ensureOnline,
    runMutation,
    applyOnlineOnly,
    handleNetworkFailure,
    markConnectionHealthy,
    setDegradedState,
    markLocalDataChanged,
    addLog,
    syncStoredAuthUser,
    updateSyncMeta,
    clearParticipantImportCachesRef,
  };
}
