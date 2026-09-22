import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ActivityLog,
  AppDiagnostics,
  ConnectionState,
  Event,
  Organization,
  Participant,
  ParticipantFieldMapping,
  ParticipantQrPreview,
  ParticipantScanResult,
  ParticipantStatus,
  QrEmailDeliveryReport,
  Role,
  ScannerMode,
  ServiceWorkerState,
  SnapshotSource,
  User,
} from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  API_BASE_URL,
  fetchJson,
  isApiResponseError,
  isNetworkRequestError,
} from "@/lib/api";
import {
  type ApiParticipant,
  type BootstrapResponse,
  type ParticipantScanApiResponse,
  OFFLINE_ACTION_MESSAGE,
  applyPendingMutations,
  buildOfflineSnapshot,
  createBootstrapSnapshotVersion,
  createClientMutationId,
  extractConflictParticipant,
  getDefaultCurrentUser,
  getDeviceId,
  getInitialConnectionState,
  getSelectableOrganizationsForUser,
  getVisibleEventsForUser,
  mapApiEventToUi,
  mapApiOrganizationToUi,
  mapApiParticipantToUi,
  mapApiUserToUi,
  participantUiIdToApiId,
  persistStoredSelectedEventId,
  persistStoredSelectedOrganizationId,
  readStoredSelectedEventId,
  readStoredSelectedOrganizationId,
  resolveSelectedEventId,
  resolveSelectedOrganizationId,
} from "@/lib/data-context-helpers";
import {
  deletePendingMutation,
  loadBootstrapSnapshot,
  loadPendingMutations,
  loadSyncMeta,
  saveBootstrapSnapshot,
  savePendingMutation,
  saveSyncMeta,
  updatePendingMutation,
  type OfflineBootstrapSnapshot,
  type PendingParticipantMutation,
} from "@/lib/offline-store";
import { isEventOfficeOpen } from "@/lib/events";
import { hasGlobalOrganizationScope } from "@/lib/roles";
import { checkBrowserStorage } from "@/lib/browser-storage";
import { useOrganizationMutations } from "@/contexts/data/useOrganizationMutations";
import { useUserMutations } from "@/contexts/data/useUserMutations";
import {
  useParticipantImport,
  type ParticipantFieldMappingUpdateResult,
  type ParticipantFieldMappingsState,
  type ParticipantImportAnalysis,
  type ParticipantImportMappingPayload,
  type ParticipantImportRunResult,
  type ParticipantListResetResult,
} from "@/contexts/data/useParticipantImport";
import { useEventMutations } from "@/contexts/data/useEventMutations";
import { useParticipantMutations } from "@/contexts/data/useParticipantMutations";

type UserCreateInput = Omit<User, "id" | "password"> & { password?: string };
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
interface ParticipantUpdateOptions {
  allowOfflineQueue?: boolean;
}
interface ParticipantBibNumberUpdateOptions {
  conflictResolution?: "keep_duplicates" | "delete_conflicts";
}
interface OrganizationUpdateInput {
  name?: string;
  event_limit?: number;
}
interface UserUpdateInput {
  name: string;
  email: string;
}

interface DataContextType {
  organizations: Organization[];
  events: Event[];
  archivedEvents: Event[];
  participants: Participant[];
  users: User[];
  activityLog: ActivityLog[];
  currentRole: Role;
  currentUser: User;
  selectedOrganizationId: string;
  setSelectedOrganizationId: (id: string) => void;
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  selectEventContext: (eventId: string) => void;
  updateParticipantStatus: (
    participantId: string,
    status: ParticipantStatus,
    options?: ParticipantUpdateOptions
  ) => Promise<MutationResult>;
  updateParticipantBibNumber: (
    participantId: string,
    bibNumber: string,
    options?: ParticipantBibNumberUpdateOptions
  ) => Promise<ParticipantBibNumberUpdateResult>;
  updateParticipantDetails: (
    participantId: string,
    email: string,
    fieldValues: Record<string, string>
  ) => Promise<MutationResult>;
  analyzeParticipantImport: (
    eventId: string,
    csvContent: string
  ) => Promise<ParticipantImportAnalysis>;
  confirmParticipantImportMapping: (
    eventId: string,
    payload: ParticipantImportMappingPayload
  ) => Promise<ParticipantFieldMapping[]>;
  runParticipantImport: (
    eventId: string,
    csvContent: string
  ) => Promise<ParticipantImportRunResult>;
  replaceParticipantImport: (
    eventId: string,
    csvContent: string,
    mapping: ParticipantImportMappingPayload,
    confirmQrSent?: boolean
  ) => Promise<ParticipantImportRunResult>;
  resetEventParticipantList: (
    eventId: string,
    confirmQrSent?: boolean
  ) => Promise<ParticipantListResetResult>;
  getParticipantFieldMappingsState: (
    eventId: string
  ) => Promise<ParticipantFieldMappingsState>;
  getParticipantFieldMappings: (
    eventId: string
  ) => Promise<ParticipantFieldMapping[]>;
  updateParticipantFieldMappings: (
    eventId: string,
    mappings: ParticipantFieldMapping[]
  ) => Promise<ParticipantFieldMappingUpdateResult>;
  addParticipantManually: (
    eventId: string,
    email: string,
    fieldValues: Record<string, string>
  ) => Promise<MutationResult>;
  createEvent: (e: EventMutationInput) => Promise<MutationResult>;
  createTestEvent: (organizationId: string) => Promise<MutationResult>;
  resetTestEvent: (eventId: string) => Promise<MutationResult>;
  updateEvent: (
    eventId: string,
    data: EventUpdateInput
  ) => Promise<MutationResult>;
  archiveEvent: (eventId: string) => Promise<MutationResult>;
  deleteEvent: (eventId: string) => Promise<MutationResult>;
  addUser: (u: UserCreateInput) => Promise<MutationResult>;
  updateUser: (
    userId: string,
    data: UserUpdateInput
  ) => Promise<MutationResult>;
  createOrganization: (data: {
    name: string;
    event_limit: number;
  }) => Promise<MutationResult>;
  updateOrganization: (
    organizationId: string,
    data: OrganizationUpdateInput
  ) => Promise<MutationResult>;
  updateOrganizationEventLimit: (
    organizationId: string,
    eventLimit: number
  ) => Promise<MutationResult>;
  deleteOrganization: (organizationId: string) => Promise<MutationResult>;
  removeUser: (id: string) => Promise<MutationResult>;
  triggerUserPasswordReset: (id: string) => Promise<MutationResult>;
  setUserPassword: (id: string, password: string) => Promise<MutationResult>;
  changeRole: (userId: string, role: Role) => Promise<MutationResult>;
  assignScannerEvents: (
    userId: string,
    eventIds: string[]
  ) => Promise<MutationResult>;
  sendParticipantQrEmail: (participantId: string) => Promise<MutationResult>;
  sendEventQrEmails: (
    eventId: string,
    resendAll?: boolean,
    paymentScope?: EventQrPaymentScope
  ) => Promise<EventQrEmailResult>;
  getParticipantQrPreview: (
    participantId: string
  ) => Promise<ParticipantQrPreview>;
  getEventQrEmailDeliveries: (
    eventId: string
  ) => Promise<QrEmailDeliveryReport>;
  scanParticipantQr: (qrCode: string) => Promise<{
    ok: boolean;
    data?: ParticipantScanResult;
    error?: string;
    status?: number;
  }>;
  deleteParticipant: (participantId: string) => Promise<MutationResult>;
  exportEventCsv: (eventId: string) => Promise<MutationResult>;
  exportEventLogsCsv: (eventId: string) => Promise<MutationResult>;
  exportEventParticipantChangesCsv: (
    eventId: string
  ) => Promise<MutationResult>;
  visibleEvents: Event[];
  canAccessEvent: (eventId: string) => boolean;
  canViewEvent: (eventId: string) => boolean;
  isLoading: boolean;
  connectionState: ConnectionState;
  lastSyncAt: string | null;
  snapshotSource: SnapshotSource;
  pendingMutationCount: number;
  scannerMode: ScannerMode;
  diagnostics: AppDiagnostics;
  refreshData: (silent?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);
const OFFLINE_MUTATION_LIMIT = 20;
const OFFLINE_MUTATION_WINDOW_MS = 60_000;
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

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser, token, getAuthHeaders, clearSession } = useAuth();
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
  const [pendingMutations, setPendingMutations] = useState<
    PendingParticipantMutation[]
  >([]);
  const [diagnostics, setDiagnostics] =
    useState<AppDiagnostics>(INITIAL_DIAGNOSTICS);
  const syncRef = useRef(false);
  const networkFailureCountRef = useRef(0);
  const localDataRevisionRef = useRef(0);
  // Set below, once useParticipantImport() is called further down (it needs
  // several callbacks that aren't defined yet at this point in the function
  // body). resetState() reads it indirectly through this ref so it can stay
  // declared early without a temporal-dead-zone reference.
  const clearParticipantImportCachesRef = useRef<() => void>(() => {});

  const participants = useMemo(
    () => applyPendingMutations(participantRecords, pendingMutations),
    [participantRecords, pendingMutations]
  );
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
  const pendingMutationCount = useMemo(
    () =>
      pendingMutations.filter((mutation) => mutation.state === "queued").length,
    [pendingMutations]
  );
  const offlineDurationMs = useMemo(
    () =>
      !offlineSinceAt
        ? 0
        : Math.max(0, nowTimestamp - new Date(offlineSinceAt).getTime()),
    [nowTimestamp, offlineSinceAt]
  );
  const scannerMode = useMemo<ScannerMode>(() => {
    if (connectionState === "online") return "online";
    if (!diagnostics.indexedDbAvailable) return "read_only";
    return offlineDurationMs > OFFLINE_MUTATION_WINDOW_MS ||
      pendingMutationCount > OFFLINE_MUTATION_LIMIT
      ? "read_only"
      : "offline_queue";
  }, [
    connectionState,
    diagnostics.indexedDbAvailable,
    offlineDurationMs,
    pendingMutationCount,
  ]);

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
  const replaceParticipantRecord = useCallback(
    (participant: Participant) =>
      setParticipantRecords((previous) =>
        previous.map((item) =>
          item.id === participant.id
            ? { ...participant, sync_state: "synced", sync_error: undefined }
            : item
        )
      ),
    []
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
    async <T,>(executor: () => Promise<T>, offlineMessage?: string) => {
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
      setPendingMutations([]);
      setSnapshotSource("none");
      setLastSyncAt(null);
      return;
    }
    setSelectedOrganizationIdState(
      readStoredSelectedOrganizationId(authUser.id)
    );
    setSelectedEventIdState(readStoredSelectedEventId(authUser.id));
    void loadPendingMutations(API_BASE_URL, authUser.id)
      .then(setPendingMutations)
      .catch(() => setPendingMutations([]));
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
      !authUser?.id ||
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
      if (syncedAtLeastOne && authUser?.id) {
        const syncedAt = new Date().toISOString();
        setLastSyncAt(syncedAt);
        await updateSyncMeta(authUser.id, syncedAt, null);
      }
    } finally {
      syncRef.current = false;
    }
  }, [
    authUser?.id,
    clearSession,
    connectionState,
    handleNetworkFailure,
    pendingMutations,
    replaceParticipantRecord,
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
        const reason = diagnostics.indexedDbAvailable
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
        userId: authUser?.id ?? "unknown",
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
      authUser?.id,
      connectionState,
      diagnostics.indexedDbAvailable,
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

  const {
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
  } = useParticipantImport({
    setParticipantRecords,
    addLog,
    applyOnlineOnly,
    ensureOnline,
    handleNetworkFailure,
    getAuthHeaders,
    loadBootstrap,
  });
  clearParticipantImportCachesRef.current = clearParticipantImportCaches;

  const {
    createEvent,
    createTestEvent,
    resetTestEvent,
    updateEvent,
    archiveEvent,
    deleteEvent,
    exportEventCsv,
    exportEventLogsCsv,
  } = useEventMutations({
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
  });

  const {
    addUser,
    updateUser,
    removeUser,
    triggerUserPasswordReset,
    setUserPassword,
    changeRole,
    assignScannerEvents,
  } = useUserMutations({
    users,
    setUsers,
    ensureOnline,
    runMutation,
    addLog,
    markLocalDataChanged,
    getAuthHeaders,
    syncStoredAuthUser,
  });

  const {
    createOrganization,
    updateOrganization,
    updateOrganizationEventLimit,
    deleteOrganization,
  } = useOrganizationMutations({
    organizations,
    setOrganizations,
    events,
    ensureOnline,
    runMutation,
    addLog,
    markLocalDataChanged,
    getAuthHeaders,
    loadBootstrap,
  });

  const scanParticipantQr = useCallback(
    async (qrCode: string) => {
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

  const {
    updateParticipantBibNumber,
    updateParticipantDetails,
    addParticipantManually,
    deleteParticipant,
    sendParticipantQrEmail,
    sendEventQrEmails,
    getParticipantQrPreview,
    getEventQrEmailDeliveries,
    exportEventParticipantChangesCsv,
  } = useParticipantMutations({
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
  });

  return (
    <DataContext.Provider
      value={{
        organizations,
        events,
        archivedEvents,
        participants,
        users,
        activityLog,
        currentRole,
        currentUser,
        selectedOrganizationId,
        setSelectedOrganizationId,
        selectedEventId,
        setSelectedEventId,
        selectEventContext,
        updateParticipantStatus,
        updateParticipantBibNumber,
        updateParticipantDetails,
        analyzeParticipantImport,
        confirmParticipantImportMapping,
        runParticipantImport,
        replaceParticipantImport,
        resetEventParticipantList,
        getParticipantFieldMappingsState,
        getParticipantFieldMappings,
        updateParticipantFieldMappings,
        addParticipantManually,
        createEvent,
        createTestEvent,
        resetTestEvent,
        updateEvent,
        archiveEvent,
        deleteEvent,
        addUser,
        updateUser,
        createOrganization,
        updateOrganization,
        updateOrganizationEventLimit,
        deleteOrganization,
        removeUser,
        triggerUserPasswordReset,
        setUserPassword,
        changeRole,
        assignScannerEvents,
        sendParticipantQrEmail,
        sendEventQrEmails,
        getParticipantQrPreview,
        getEventQrEmailDeliveries,
        scanParticipantQr,
        deleteParticipant,
        exportEventCsv,
        exportEventLogsCsv,
        exportEventParticipantChangesCsv,
        visibleEvents,
        canAccessEvent,
        canViewEvent,
        isLoading,
        connectionState,
        lastSyncAt,
        snapshotSource,
        pendingMutationCount,
        scannerMode,
        diagnostics,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
