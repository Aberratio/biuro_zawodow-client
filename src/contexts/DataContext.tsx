import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityLog, AppDiagnostics, ConnectionState, Event, Organization, Participant, ParticipantFieldMapping, ParticipantQrPreview, ParticipantScanResult, ParticipantStatus, Role, ScannerMode, ServiceWorkerState, SnapshotSource, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, fetchJson, getApiErrorCode, isApiResponseError, isNetworkRequestError } from '@/lib/api';
import { type ApiEvent, type ApiOrganization, type ApiParticipant, type ApiUser, type BootstrapResponse, type ParticipantQrPreviewResponse, type ParticipantScanApiResponse, OFFLINE_ACTION_MESSAGE, applyPendingMutations, buildOfflineSnapshot, createBootstrapSnapshotVersion, createClientMutationId, extractConflictParticipant, getDefaultCurrentUser, getDeviceId, getInitialConnectionState, getSelectableOrganizationsForUser, getVisibleEventsForUser, mapApiOrganizationToUi, mapApiParticipantToUi, mapApiUserToUi, participantUiIdToApiId, persistStoredSelectedEventId, persistStoredSelectedOrganizationId, readStoredSelectedEventId, readStoredSelectedOrganizationId, resolveSelectedEventId, resolveSelectedOrganizationId } from '@/lib/data-context-helpers';
import { deletePendingMutation, loadBootstrapSnapshot, loadPendingMutations, loadSyncMeta, saveBootstrapSnapshot, savePendingMutation, saveSyncMeta, updatePendingMutation, type OfflineBootstrapSnapshot, type PendingParticipantMutation } from '@/lib/offline-store';
import { getEventOfficeCloseAt, isEventOfficeOpen } from '@/lib/events';
import { hasGlobalOrganizationScope } from '@/lib/roles';
import { checkBrowserStorage } from '@/lib/browser-storage';

type UserCreateInput = Omit<User, 'id' | 'password'> & { password?: string };
type EventMutationInput = Omit<Event, 'id' | 'archived_at' | 'deleted_at'>;
type EventUpdateInput = EventMutationInput & { reopen_office?: boolean };

interface MutationResult { ok: boolean; error?: string; entityId?: string; queued?: boolean; }
interface ParticipantBibNumberConflict { bibNumber: string; conflictingParticipants: Participant[]; }
interface ParticipantBibNumberUpdateResult extends MutationResult { conflict?: ParticipantBibNumberConflict; }
interface EventQrEmailResult { ok: boolean; sent_count: number; error_count: number; errors: Array<{ participant_id: number; participant_name: string; error: string }>; error?: string; }
interface ParticipantImportListDifference { columns_differ: boolean; missing_columns: string[]; extra_columns: string[]; participant_difference_ratio: number; should_offer_replacement: boolean; }
interface ParticipantImportAnalysis { headers: string[]; sample_rows: Record<string, string>[]; email_candidates: { column: string; matched_count: number }[]; has_mapping: boolean; has_baseline_import: boolean; mappings: ParticipantFieldMapping[]; missing_required_columns: string[]; row_count: number; existing_participant_count: number; sent_qr_email_count: number; list_difference: ParticipantImportListDifference; }
interface ParticipantImportMappingFieldInput {
  source_column_name: string;
  alias: string;
  field_role: 'display_name_part' | 'bib_number' | 'custom' | 'important_custom';
  field_type?: ParticipantFieldMapping['field_type'];
  validation_rules?: ParticipantFieldMapping['validation_rules'];
  is_required?: boolean;
  is_active: boolean;
}
interface ParticipantImportMappingPayload { csv_columns: string[]; email_column: string; fields: ParticipantImportMappingFieldInput[]; }
interface ParticipantFieldMappingUpdateResult extends MutationResult { mappings: ParticipantFieldMapping[]; has_baseline_import: boolean; }
interface ParticipantImportRowIssue { row_number: number; reasons: string[]; row: Record<string, string>; matched_by?: string; }
interface ParticipantImportRunResult { created_count: number; duplicate_count: number; invalid_count: number; invalid_rows: number[]; invalid_row_details: ParticipantImportRowIssue[]; duplicate_row_details: ParticipantImportRowIssue[]; participants: Participant[]; reset?: Record<string, unknown>; }
interface ParticipantListResetResult extends MutationResult { deleted_participant_count: number; deleted_mapping_count: number; deleted_baseline_record_count: number; deleted_change_log_count: number; qrEmailsSent?: boolean; sent_qr_email_count?: number; }
interface ParticipantFieldMappingsState { has_mapping: boolean; has_baseline_import: boolean; mappings: ParticipantFieldMapping[]; }
interface ParticipantUpdateOptions { allowOfflineQueue?: boolean; }
interface ParticipantBibNumberUpdateOptions { conflictResolution?: 'keep_duplicates' | 'delete_conflicts'; }
interface OrganizationUpdateInput { name?: string; event_limit?: number; }
interface UserUpdateInput { name: string; email: string; }

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
  updateParticipantStatus: (participantId: string, status: ParticipantStatus, options?: ParticipantUpdateOptions) => Promise<MutationResult>;
  updateParticipantBibNumber: (participantId: string, bibNumber: string, options?: ParticipantBibNumberUpdateOptions) => Promise<ParticipantBibNumberUpdateResult>;
  updateParticipantDetails: (participantId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  analyzeParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportAnalysis>;
  confirmParticipantImportMapping: (eventId: string, payload: ParticipantImportMappingPayload) => Promise<ParticipantFieldMapping[]>;
  runParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportRunResult>;
  replaceParticipantImport: (eventId: string, csvContent: string, mapping: ParticipantImportMappingPayload, confirmQrSent?: boolean) => Promise<ParticipantImportRunResult>;
  resetEventParticipantList: (eventId: string, confirmQrSent?: boolean) => Promise<ParticipantListResetResult>;
  getParticipantFieldMappingsState: (eventId: string) => Promise<ParticipantFieldMappingsState>;
  getParticipantFieldMappings: (eventId: string) => Promise<ParticipantFieldMapping[]>;
  updateParticipantFieldMappings: (eventId: string, mappings: ParticipantFieldMapping[]) => Promise<ParticipantFieldMappingUpdateResult>;
  addParticipantManually: (eventId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  createEvent: (e: EventMutationInput) => Promise<MutationResult>;
  updateEvent: (eventId: string, data: EventUpdateInput) => Promise<MutationResult>;
  archiveEvent: (eventId: string) => Promise<MutationResult>;
  deleteEvent: (eventId: string) => Promise<MutationResult>;
  addUser: (u: UserCreateInput) => Promise<MutationResult>;
  updateUser: (userId: string, data: UserUpdateInput) => Promise<MutationResult>;
  createOrganization: (data: { name: string; event_limit: number }) => Promise<MutationResult>;
  updateOrganization: (organizationId: string, data: OrganizationUpdateInput) => Promise<MutationResult>;
  updateOrganizationEventLimit: (organizationId: string, eventLimit: number) => Promise<MutationResult>;
  deleteOrganization: (organizationId: string) => Promise<MutationResult>;
  removeUser: (id: string) => Promise<MutationResult>;
  triggerUserPasswordReset: (id: string) => Promise<MutationResult>;
  setUserPassword: (id: string, password: string) => Promise<MutationResult>;
  changeRole: (userId: string, role: Role) => Promise<MutationResult>;
  assignScannerEvents: (userId: string, eventIds: string[]) => Promise<MutationResult>;
  sendParticipantQrEmail: (participantId: string) => Promise<MutationResult>;
  sendEventQrEmails: (eventId: string, resendAll?: boolean) => Promise<EventQrEmailResult>;
  getParticipantQrPreview: (participantId: string) => Promise<ParticipantQrPreview>;
  scanParticipantQr: (qrCode: string) => Promise<{ ok: boolean; data?: ParticipantScanResult; error?: string; status?: number }>;
  deleteParticipant: (participantId: string) => Promise<MutationResult>;
  exportEventCsv: (eventId: string) => Promise<MutationResult>;
  exportEventLogsCsv: (eventId: string) => Promise<MutationResult>;
  exportEventParticipantChangesCsv: (eventId: string) => Promise<MutationResult>;
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
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);
const OFFLINE_MUTATION_LIMIT = 20;
const OFFLINE_MUTATION_WINDOW_MS = 60_000;
const CONNECTION_RECOVERY_INTERVAL_MS = 15_000;
const NETWORK_FAILURE_THRESHOLD = 2;
const PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS = 60_000;
const PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS = 10_000;
const INITIAL_DIAGNOSTICS: AppDiagnostics = {
  sessionStorageAvailable: true,
  localStorageAvailable: true,
  indexedDbAvailable: true,
  canPersistSession: true,
  serviceWorkerState: 'checking',
  warnings: [],
};

interface ParticipantUpdatePayload {
  status?: ParticipantStatus;
  email?: string;
  bib_number?: string | null;
  bib_number_conflict_resolution?: 'keep_duplicates' | 'delete_conflicts';
  field_values?: Record<string, string>;
  client_mutation_id?: string;
  device_id?: string;
  event_id?: string;
  base_status?: ParticipantStatus;
}

function normalizeScanParticipantErrorMessage(error: unknown): string {
  if (isApiResponseError(error) && error.status === 403) {
    return 'Ten kod QR należy do uczestnika z innego wydarzenia niż aktualnie wybrane.';
  }

  return error instanceof Error ? error.message : 'Nie udało się odczytać uczestnika.';
}

function mapParticipantImportRowIssues(value: unknown): ParticipantImportRowIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map(entry => ({
      row_number: Number(entry.row_number ?? 0),
      reasons: Array.isArray(entry.reasons) ? entry.reasons.map(reason => String(reason)) : [],
      row: entry.row && typeof entry.row === 'object'
        ? Object.fromEntries(Object.entries(entry.row as Record<string, unknown>).map(([key, cell]) => [key, String(cell ?? '')]))
        : {},
      matched_by: typeof entry.matched_by === 'string' ? entry.matched_by : undefined,
    }))
    .filter(entry => entry.row_number > 0);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser, token, getAuthHeaders, clearSession } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<Event[]>([]);
  const [participantRecords, setParticipantRecords] = useState<Participant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState('');
  const [selectedEventId, setSelectedEventIdState] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [connectionState, setConnectionState] = useState<ConnectionState>(getInitialConnectionState);
  const [snapshotSource, setSnapshotSource] = useState<SnapshotSource>('none');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [offlineSinceAt, setOfflineSinceAt] = useState<string | null>(() => getInitialConnectionState() === 'offline' ? new Date().toISOString() : null);
  const [pendingMutations, setPendingMutations] = useState<PendingParticipantMutation[]>([]);
  const [diagnostics, setDiagnostics] = useState<AppDiagnostics>(INITIAL_DIAGNOSTICS);
  const syncRef = useRef(false);
  const networkFailureCountRef = useRef(0);
  const participantFieldMappingsCacheRef = useRef(new Map<string, { fetchedAt: number; mappings: ParticipantFieldMapping[] }>());
  const participantFieldMappingsInFlightRef = useRef(new Map<string, Promise<ParticipantFieldMapping[]>>());
  const participantFieldMappingsStateCacheRef = useRef(new Map<string, { fetchedAt: number; state: ParticipantFieldMappingsState }>());
  const participantFieldMappingsStateInFlightRef = useRef(new Map<string, Promise<ParticipantFieldMappingsState>>());
  const participantFieldMappingsFailureUntilRef = useRef(new Map<string, number>());
  const localDataRevisionRef = useRef(0);

  const participants = useMemo(() => applyPendingMutations(participantRecords, pendingMutations), [participantRecords, pendingMutations]);
  const currentUser = useMemo(() => !authUser ? getDefaultCurrentUser() : users.find(user => user.id === authUser.id) || authUser, [users, authUser]);
  const currentRole = currentUser.role;
  const usesOrganizationContext = hasGlobalOrganizationScope(currentRole);
  const visibleEvents = useMemo(() => getVisibleEventsForUser(events, currentUser, new Date(nowTimestamp)), [events, currentUser, nowTimestamp]);
  const selectableOrganizations = useMemo(() => getSelectableOrganizationsForUser(organizations, currentUser), [organizations, currentUser]);
  const eventSelectionScope = useMemo(() => usesOrganizationContext && selectedOrganizationId ? visibleEvents.filter(event => event.organization_id === selectedOrganizationId) : visibleEvents, [selectedOrganizationId, usesOrganizationContext, visibleEvents]);
  const pendingMutationCount = useMemo(() => pendingMutations.filter(mutation => mutation.state === 'queued').length, [pendingMutations]);
  const offlineDurationMs = useMemo(() => !offlineSinceAt ? 0 : Math.max(0, nowTimestamp - new Date(offlineSinceAt).getTime()), [nowTimestamp, offlineSinceAt]);
  const scannerMode = useMemo<ScannerMode>(() => {
    if (connectionState === 'online') return 'online';
    if (!diagnostics.indexedDbAvailable) return 'read_only';
    return offlineDurationMs > OFFLINE_MUTATION_WINDOW_MS || pendingMutationCount > OFFLINE_MUTATION_LIMIT ? 'read_only' : 'offline_queue';
  }, [connectionState, diagnostics.indexedDbAvailable, offlineDurationMs, pendingMutationCount]);

  const persistSelectedOrganizationId = useCallback((organizationId: string, userId?: string | null) => {
    if (!userId) return;
    persistStoredSelectedOrganizationId(userId, organizationId);
  }, []);

  const setSelectedOrganizationId = useCallback((organizationId: string) => {
    setSelectedOrganizationIdState(organizationId);
    persistSelectedOrganizationId(organizationId, authUser?.id);
  }, [authUser?.id, persistSelectedOrganizationId]);

  const persistSelectedEventId = useCallback((eventId: string, userId?: string | null) => {
    if (!userId) return;
    persistStoredSelectedEventId(userId, eventId);
  }, []);

  const setSelectedEventId = useCallback((eventId: string) => {
    setSelectedEventIdState(eventId);
    persistSelectedEventId(eventId, authUser?.id);
  }, [authUser?.id, persistSelectedEventId]);

  const selectEventContext = useCallback((eventId: string) => {
    const nextEventId = eventId.trim();
    const nextEvent = visibleEvents.find(event => event.id === nextEventId) ?? events.find(event => event.id === nextEventId);

    if (hasGlobalOrganizationScope(currentRole)) {
      const nextOrganizationId = nextEvent?.organization_id ?? '';
      if (nextOrganizationId !== selectedOrganizationId) {
        setSelectedOrganizationIdState(nextOrganizationId);
        persistSelectedOrganizationId(nextOrganizationId, authUser?.id);
      }
    }

    setSelectedEventIdState(nextEventId);
    persistSelectedEventId(nextEventId, authUser?.id);
  }, [authUser?.id, currentRole, events, persistSelectedEventId, persistSelectedOrganizationId, selectedOrganizationId, visibleEvents]);

  const syncStoredAuthUser = useCallback((updater: (user: User) => User) => {
    try {
      const raw = sessionStorage.getItem('auth_user') ?? localStorage.getItem('auth_user');
      if (!raw) return;

      const nextValue = JSON.stringify(updater(JSON.parse(raw) as User));
      sessionStorage.setItem('auth_user', nextValue);
      localStorage.setItem('auth_user', nextValue);
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
    setSelectedOrganizationIdState('');
    setSelectedEventIdState('');
    setSnapshotSource('none');
    setLastSyncAt(null);
    participantFieldMappingsCacheRef.current.clear();
    participantFieldMappingsInFlightRef.current.clear();
    participantFieldMappingsFailureUntilRef.current.clear();
    networkFailureCountRef.current = 0;
  }, []);

  const markConnectionHealthy = useCallback(() => {
    networkFailureCountRef.current = 0;
    setConnectionState('online');
    setOfflineSinceAt(null);
  }, []);

  const setDegradedState = useCallback((source?: SnapshotSource) => {
    setConnectionState(typeof navigator !== 'undefined' && navigator.onLine ? 'degraded' : 'offline');
    setOfflineSinceAt(previous => previous ?? new Date().toISOString());
    if (source) {
      setSnapshotSource(source);
    }
  }, []);

  const ensureOnline = useCallback((message = OFFLINE_ACTION_MESSAGE) => connectionState === 'online' ? null : message, [connectionState]);
  const markLocalDataChanged = useCallback(() => { localDataRevisionRef.current += 1; }, []);
  const handleNetworkFailure = useCallback((error: unknown, options?: { immediate?: boolean }) => {
    if (!isNetworkRequestError(error)) return;
    networkFailureCountRef.current += 1;
    if (options?.immediate || networkFailureCountRef.current >= NETWORK_FAILURE_THRESHOLD) {
      setDegradedState();
    }
  }, [setDegradedState]);
  const replaceParticipantRecord = useCallback((participant: Participant) => setParticipantRecords(previous => previous.map(item => item.id === participant.id ? { ...participant, sync_state: 'synced', sync_error: undefined } : item)), []);
  const addLog = useCallback((action: string, participantName?: string) => setActivityLog(previous => [{ id: `log-${Date.now()}`, timestamp: new Date().toISOString(), action, participant_name: participantName, user_name: currentUser.name }, ...previous]), [currentUser.name]);

  const updateSyncMeta = useCallback(async (userId: string, nextLastSyncAt: string | null, nextOfflineSinceAt: string | null) => {
    await saveSyncMeta({ key: `${API_BASE_URL}::${userId}`, apiBaseUrl: API_BASE_URL, userId, lastSyncAt: nextLastSyncAt, offlineSinceAt: nextOfflineSinceAt });
  }, []);

  const applyOnlineOnly = useCallback(async <T,>(executor: () => Promise<T>, offlineMessage?: string) => {
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
  }, [ensureOnline, handleNetworkFailure, markConnectionHealthy]);

  const runMutation = useCallback(async (executor: () => Promise<MutationResult>): Promise<MutationResult> => {
    try {
      const result = await executor();
      markConnectionHealthy();
      return result;
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: error instanceof Error ? error.message : 'Wystąpił błąd.' };
    }
  }, [handleNetworkFailure, markConnectionHealthy]);

  const hydrateData = useCallback((responseData: BootstrapResponse['data'] | OfflineBootstrapSnapshot['data'], source: SnapshotSource, generatedAt: string, preferredOrganizationId = '', preferredEventId = '') => {
    if (!authUser) return;
    const nextOrganizations = Array.isArray(responseData.organizations) ? responseData.organizations.map(mapApiOrganizationToUi) : [];
    const nextEvents = Array.isArray(responseData.events) ? responseData.events : [];
    const nextArchivedEvents = Array.isArray(responseData.archivedEvents) ? responseData.archivedEvents : [];
    const nextUsers = (responseData.users ?? []).map(mapApiUserToUi);
    const nextCurrentUser = nextUsers.find(user => user.id === authUser.id) ?? authUser;
    const nextVisibleEvents = getVisibleEventsForUser(nextEvents, nextCurrentUser);
    const nextSelectableOrganizations = getSelectableOrganizationsForUser(nextOrganizations, nextCurrentUser);
    const preferredOrg = readStoredSelectedOrganizationId(authUser.id) || preferredOrganizationId;
    const nextUsesOrganizationContext = hasGlobalOrganizationScope(nextCurrentUser.role);
    const nextSelectedOrganization = nextUsesOrganizationContext ? resolveSelectedOrganizationId(nextSelectableOrganizations, preferredOrg) : '';
    const scopedEvents = nextUsesOrganizationContext && nextSelectedOrganization ? nextVisibleEvents.filter(event => event.organization_id === nextSelectedOrganization) : nextVisibleEvents;
    const preferredEvt = readStoredSelectedEventId(authUser.id) || preferredEventId;
    const nextSelectedEvent = resolveSelectedEventId(scopedEvents, preferredEvt);
    const nextParticipants = (responseData.participants ?? []).map(participant => mapApiParticipantToUi(participant, ''));
    setOrganizations(nextOrganizations); setEvents(nextEvents); setArchivedEvents(nextArchivedEvents); setUsers(nextUsers); setParticipantRecords(nextParticipants); setActivityLog(Array.isArray(responseData.activityLog) ? responseData.activityLog : []); setSelectedOrganizationIdState(nextSelectedOrganization); setSelectedEventIdState(nextSelectedEvent); persistSelectedOrganizationId(nextSelectedOrganization, authUser.id); persistSelectedEventId(nextSelectedEvent, authUser.id); setSnapshotSource(source); setLastSyncAt(generatedAt);
  }, [authUser, persistSelectedEventId, persistSelectedOrganizationId]);

  const restoreCachedBootstrap = useCallback(async () => {
    if (!authUser?.id) return false;
    const snapshot = await loadBootstrapSnapshot(API_BASE_URL, authUser.id);
    if (!snapshot) return false;
    hydrateData(snapshot.data, 'cache', snapshot.savedAt, snapshot.selectedOrganizationId, snapshot.selectedEventId);
    setDegradedState('cache');
    return true;
  }, [authUser?.id, hydrateData, setDegradedState]);

  const loadBootstrap = useCallback(async (silent = false) => {
    const requestRevision = localDataRevisionRef.current;
    if (!silent) setIsLoading(true);
    if (!authUser || !token) { resetState(); setIsLoading(false); return; }
    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/bootstrap`, { headers: getAuthHeaders() });
      const response = payload as BootstrapResponse;
      if (requestRevision !== localDataRevisionRef.current) {
        markConnectionHealthy();
        return;
      }
      const generatedAt = response.generated_at ?? new Date().toISOString();
      const snapshotVersion = response.snapshot_version ?? createBootstrapSnapshotVersion(response.data);
      hydrateData(response.data, 'network', generatedAt);
      markConnectionHealthy();
      await saveBootstrapSnapshot(buildOfflineSnapshot({ userId: authUser.id, selectedOrganizationId: readStoredSelectedOrganizationId(authUser.id), selectedEventId: readStoredSelectedEventId(authUser.id), organizations: Array.isArray(response.data.organizations) ? response.data.organizations.map(mapApiOrganizationToUi) : [], events: Array.isArray(response.data.events) ? response.data.events : [], archivedEvents: Array.isArray(response.data.archivedEvents) ? response.data.archivedEvents : [], users: (response.data.users ?? []).map(mapApiUserToUi), participants: (response.data.participants ?? []).map(participant => mapApiParticipantToUi(participant, '')), activityLog: Array.isArray(response.data.activityLog) ? response.data.activityLog : [], generatedAt, snapshotVersion }));
      await updateSyncMeta(authUser.id, generatedAt, null);
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
  }, [authUser, clearSession, getAuthHeaders, handleNetworkFailure, hydrateData, markConnectionHealthy, resetState, restoreCachedBootstrap, setDegradedState, token, updateSyncMeta]);

  const refreshData = useCallback(async () => { await loadBootstrap(); }, [loadBootstrap]);

  useEffect(() => { void loadBootstrap(); }, [loadBootstrap]);
  useEffect(() => {
    let mounted = true;

    const refreshStorageDiagnostics = async () => {
      try {
        const storage = await checkBrowserStorage();
        if (!mounted) return;
        setDiagnostics(previous => ({
          ...previous,
          sessionStorageAvailable: storage.sessionStorageAvailable,
          localStorageAvailable: storage.localStorageAvailable,
          indexedDbAvailable: storage.indexedDbAvailable,
          canPersistSession: storage.canPersistSession,
          warnings: storage.warnings,
        }));
      } catch {
        if (!mounted) return;
        setDiagnostics(previous => ({
          ...previous,
          indexedDbAvailable: false,
          warnings: Array.from(new Set([...previous.warnings, 'Nie udało się sprawdzić pamięci offline aplikacji. Tryb offline może być niedostępny.'])),
        }));
      }
    };

    void refreshStorageDiagnostics();
    window.addEventListener('focus', refreshStorageDiagnostics);

    return () => {
      mounted = false;
      window.removeEventListener('focus', refreshStorageDiagnostics);
    };
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setDiagnostics(previous => ({ ...previous, serviceWorkerState: 'unsupported' }));
      return undefined;
    }

    let mounted = true;

    const setServiceWorkerState = (serviceWorkerState: ServiceWorkerState) => {
      if (mounted) {
        setDiagnostics(previous => ({ ...previous, serviceWorkerState }));
      }
    };

    const refreshServiceWorkerState = async () => {
      if (!import.meta.env.PROD) {
        setServiceWorkerState('ready');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
        setServiceWorkerState(registration ? 'ready' : 'unavailable');
      } catch {
        setServiceWorkerState('unavailable');
      }
    };

    const handleReady = () => setServiceWorkerState('ready');
    const handleUnavailable = () => setServiceWorkerState('unavailable');

    window.addEventListener('biuro-zawodow:service-worker-ready', handleReady);
    window.addEventListener('biuro-zawodow:service-worker-unavailable', handleUnavailable);
    void refreshServiceWorkerState();

    return () => {
      mounted = false;
      window.removeEventListener('biuro-zawodow:service-worker-ready', handleReady);
      window.removeEventListener('biuro-zawodow:service-worker-unavailable', handleUnavailable);
    };
  }, []);
  useEffect(() => {
    if (!authUser?.id) { setPendingMutations([]); setSnapshotSource('none'); setLastSyncAt(null); return; }
    setSelectedOrganizationIdState(readStoredSelectedOrganizationId(authUser.id));
    setSelectedEventIdState(readStoredSelectedEventId(authUser.id));
    void loadPendingMutations(API_BASE_URL, authUser.id).then(setPendingMutations).catch(() => setPendingMutations([]));
    void loadSyncMeta(API_BASE_URL, authUser.id).then(meta => { if (!meta) return; setLastSyncAt(meta.lastSyncAt); setOfflineSinceAt(meta.offlineSinceAt); }).catch(() => undefined);
  }, [authUser?.id]);
  useEffect(() => { const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 30_000); return () => window.clearInterval(intervalId); }, []);
  useEffect(() => {
    const handleOnline = () => { setConnectionState(previous => previous === 'online' ? 'online' : 'degraded'); void loadBootstrap(true); };
    const handleOffline = () => { setConnectionState('offline'); setOfflineSinceAt(previous => previous ?? new Date().toISOString()); };
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [loadBootstrap]);
  useEffect(() => {
    if (!authUser?.id || !token || connectionState === 'online') return undefined;
    const intervalId = window.setInterval(() => { void loadBootstrap(true); }, CONNECTION_RECOVERY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [authUser?.id, connectionState, loadBootstrap, token]);
  useEffect(() => { if (authUser?.id) void updateSyncMeta(authUser.id, lastSyncAt, offlineSinceAt); }, [authUser?.id, lastSyncAt, offlineSinceAt, updateSyncMeta]);
  useEffect(() => {
    if (!usesOrganizationContext) {
      if (selectedOrganizationId !== '') setSelectedOrganizationId('');
      return;
    }

    if (isLoading) return;

    const nextSelectedOrganizationId = resolveSelectedOrganizationId(selectableOrganizations, selectedOrganizationId);
    if (nextSelectedOrganizationId !== selectedOrganizationId) setSelectedOrganizationId(nextSelectedOrganizationId);
  }, [isLoading, selectableOrganizations, selectedOrganizationId, setSelectedOrganizationId, usesOrganizationContext]);
  useEffect(() => {
    if (isLoading) return;

    const nextVisibleEventId = eventSelectionScope[0]?.id ?? '';
    if (eventSelectionScope.some(event => event.id === selectedEventId) || nextVisibleEventId === selectedEventId) return;
    setSelectedEventId(nextVisibleEventId);
  }, [eventSelectionScope, isLoading, selectedEventId, setSelectedEventId]);

  const canAccessEvent = useCallback((eventId: string) => {
    const event = events.find(entry => entry.id === eventId) ?? archivedEvents.find(entry => entry.id === eventId);
    if (!event) return false;
    if (event.deleted_at) return false;
    if (event.archived_at) return currentRole === 'superadmin';
    if (currentRole === 'superadmin' || currentRole === 'admin') return true;
    if (currentRole === 'editor') return event.organization_id === currentUser.organization_id;
    return currentUser.assigned_events.includes(eventId) && isEventOfficeOpen(event, new Date(nowTimestamp));
  }, [archivedEvents, currentRole, currentUser, events, nowTimestamp]);

  const canViewEvent = useCallback((eventId: string) => {
    if (canAccessEvent(eventId)) return true;
    const event = archivedEvents.find(entry => entry.id === eventId);
    if (!event) return false;
    if (currentRole === 'admin') return true;
    if (currentRole === 'editor') return event.organization_id === currentUser.organization_id;
    return false;
  }, [archivedEvents, canAccessEvent, currentRole, currentUser]);

  const updateParticipantInApi = useCallback(async (participantId: string, data: ParticipantUpdatePayload) => {
    const payload = (await fetchJson(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiParticipant };
    if (!payload.data) throw new Error('API participant update returned empty payload');
    return mapApiParticipantToUi(payload.data, participants.find(participant => participant.id === participantId)?.event_id ?? '');
  }, [getAuthHeaders, participants]);

  const syncPendingMutations = useCallback(async () => {
    if (syncRef.current || !authUser?.id || !token || connectionState !== 'online') return;
    const queue = pendingMutations.filter(mutation => mutation.state === 'queued');
    if (queue.length === 0) return;
    syncRef.current = true;
    let syncedAtLeastOne = false;
    try {
      for (const mutation of queue) {
        try {
          const participant = await updateParticipantInApi(mutation.participantId, { status: mutation.nextStatus, client_mutation_id: mutation.id, device_id: mutation.deviceId, event_id: mutation.eventId, base_status: mutation.baseStatus });
          replaceParticipantRecord(participant);
          await deletePendingMutation(mutation.id);
          setPendingMutations(previous => previous.filter(item => item.id !== mutation.id));
          syncedAtLeastOne = true;
        } catch (error) {
          if (isApiResponseError(error) && error.status === 401) { clearSession(); break; }
          if (isApiResponseError(error) && error.status === 409) {
            const serverParticipant = extractConflictParticipant(error.payload);
            if (serverParticipant) replaceParticipantRecord(mapApiParticipantToUi(serverParticipant, mutation.eventId));
            await updatePendingMutation(mutation.id, current => current ? { ...current, state: 'requires_review', attempts: current.attempts + 1, error: error.message } : null);
            setPendingMutations(previous => previous.map(item => item.id === mutation.id ? { ...item, state: 'requires_review', attempts: item.attempts + 1, error: error.message } : item));
            continue;
          }
          handleNetworkFailure(error);
          await updatePendingMutation(mutation.id, current => current ? { ...current, state: 'requires_review', attempts: current.attempts + 1, error: error instanceof Error ? error.message : 'Nie udało się zsynchronizować statusu.' } : null);
          setPendingMutations(previous => previous.map(item => item.id === mutation.id ? { ...item, state: 'requires_review', attempts: item.attempts + 1, error: error instanceof Error ? error.message : 'Nie udało się zsynchronizować statusu.' } : item));
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
  }, [authUser?.id, clearSession, connectionState, handleNetworkFailure, pendingMutations, replaceParticipantRecord, token, updateParticipantInApi, updateSyncMeta]);

  const enqueueStatusUpdate = useCallback(async (
    participantId: string,
    status: ParticipantStatus,
    options?: { syncImmediately?: boolean },
  ): Promise<MutationResult> => {
    const participant = participants.find(item => item.id === participantId);
    if (!participant) return { ok: false, error: 'Nie znaleziono uczestnika.' };
    if (scannerMode === 'read_only' && connectionState !== 'online') {
      const reason = diagnostics.indexedDbAvailable
        ? 'dane są zbyt stare albo kolejka zmian jest zbyt długa'
        : 'przeglądarka blokuje trwałą pamięć offline';
      return { ok: false, error: `Skaner jest teraz tylko do odczytu, bo ${reason}.` };
    }
    const mutation: PendingParticipantMutation = { id: createClientMutationId(), apiBaseUrl: API_BASE_URL, userId: authUser?.id ?? 'unknown', participantId: participant.id, participantApiId: participantUiIdToApiId(participant.id), eventId: participant.event_id, nextStatus: status, baseStatus: participant.status, queuedAt: new Date().toISOString(), deviceId: getDeviceId(), state: 'queued', attempts: 0 };
    await savePendingMutation(mutation);
    setPendingMutations(previous => [...previous, mutation]);
    addLog('Zmieniono status uczestnika (oczekuje na synchronizację)', participant.name);
    if (options?.syncImmediately) {
      void syncPendingMutations();
    } else {
      setDegradedState();
    }
    return { ok: true, queued: true };
  }, [addLog, authUser?.id, connectionState, diagnostics.indexedDbAvailable, participants, scannerMode, setDegradedState, syncPendingMutations]);

  const queueStatusUpdate = useCallback(async (participantId: string, status: ParticipantStatus): Promise<MutationResult> => (
    enqueueStatusUpdate(participantId, status, { syncImmediately: connectionState === 'online' })
  ), [connectionState, enqueueStatusUpdate]);

  useEffect(() => { if (connectionState === 'online' && pendingMutations.some(mutation => mutation.state === 'queued')) void syncPendingMutations(); }, [connectionState, pendingMutations, syncPendingMutations]);

  const updateParticipantStatus = useCallback(async (participantId: string, status: ParticipantStatus, options?: ParticipantUpdateOptions) => {
    if (options?.allowOfflineQueue) {
      if (connectionState !== 'online') {
        return queueStatusUpdate(participantId, status);
      }

      try {
        const participant = await updateParticipantInApi(participantId, { status });
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
          return enqueueStatusUpdate(participantId, status, { syncImmediately: false });
        }

        handleNetworkFailure(error);
        return { ok: false, error: error instanceof Error ? error.message : 'Wystapil blad.' };
      }
    }
    return runMutation(async () => {
      const offlineError = ensureOnline('Zmiana statusu uczestnika jest dostępna tylko po połączeniu z serwerem.');
      if (offlineError) return { ok: false, error: offlineError };
      const participant = await updateParticipantInApi(participantId, { status });
      replaceParticipantRecord(participant);
      await loadBootstrap(true);
      return { ok: true };
    });
  }, [clearSession, connectionState, enqueueStatusUpdate, ensureOnline, handleNetworkFailure, loadBootstrap, markConnectionHealthy, queueStatusUpdate, replaceParticipantRecord, resetState, runMutation, updateParticipantInApi]);

  const updateParticipantBibNumberLegacy = useCallback(async (participantId: string, bibNumber: string) => runMutation(async () => {
    const offlineError = ensureOnline('Zmiana numeru startowego jest dostępna tylko po połączeniu z serwerem.');
    if (offlineError) return { ok: false, error: offlineError };
    const participant = await updateParticipantInApi(participantId, { bib_number: bibNumber.trim() });
    replaceParticipantRecord(participant);
    await loadBootstrap(true);
    return { ok: true };
  }), [ensureOnline, loadBootstrap, replaceParticipantRecord, runMutation, updateParticipantInApi]);

  const updateParticipantBibNumber = useCallback(async (
    participantId: string,
    bibNumber: string,
    options?: ParticipantBibNumberUpdateOptions
  ): Promise<ParticipantBibNumberUpdateResult> => {
    const offlineError = ensureOnline('Zmiana numeru startowego jest dostępna tylko po połączeniu z serwerem.');
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
      if (isApiResponseError(error) && error.status === 409 && getApiErrorCode(error) === 'bib_number_conflict') {
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
            conflictingParticipants: Array.isArray(payload.data?.conflicting_participants)
              ? payload.data.conflicting_participants.map(conflictParticipant => mapApiParticipantToUi(conflictParticipant, participants.find(participant => participant.id === participantId)?.event_id ?? ''))
              : [],
          },
        };
      }

      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zapisać numeru startowego.' };
    }
  }, [ensureOnline, handleNetworkFailure, loadBootstrap, participants, replaceParticipantRecord, updateParticipantInApi]);

  const updateParticipantDetails = useCallback(async (participantId: string, email: string, fieldValues: Record<string, string>) => runMutation(async () => {
    const offlineError = ensureOnline();
    if (offlineError) return { ok: false, error: offlineError };
    const participant = await updateParticipantInApi(participantId, { email, field_values: fieldValues });
    replaceParticipantRecord(participant);
    await loadBootstrap(true);
    return { ok: true };
  }), [ensureOnline, loadBootstrap, replaceParticipantRecord, runMutation, updateParticipantInApi]);

  const analyzeParticipantImport = useCallback(async (eventId: string, csvContent: string) => {
    const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-imports/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ csv_content: csvContent }),
    }))).payload as { data?: ParticipantImportAnalysis };

    if (!payload.data) {
      throw new Error('Nie udało się przeanalizować pliku CSV.');
    }

    return payload.data;
  }, [applyOnlineOnly, getAuthHeaders]);
  const rememberParticipantFieldMappingsState = useCallback((eventId: string, state: ParticipantFieldMappingsState) => {
    const fetchedAt = Date.now();
    participantFieldMappingsStateCacheRef.current.set(eventId, { fetchedAt, state });
    participantFieldMappingsCacheRef.current.set(eventId, { fetchedAt, mappings: state.mappings });
    participantFieldMappingsFailureUntilRef.current.delete(eventId);
  }, []);
  const markParticipantImportBaselineCache = useCallback((eventId: string) => {
    const cachedState = participantFieldMappingsStateCacheRef.current.get(eventId)?.state;
    const cachedMappings = participantFieldMappingsCacheRef.current.get(eventId)?.mappings;
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
  }, [rememberParticipantFieldMappingsState]);
  const confirmParticipantImportMapping = useCallback(async (eventId: string, payload: ParticipantImportMappingPayload) => {
    const mappings = ((await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-imports/confirm`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(payload) }))).payload as { data?: ParticipantFieldMapping[] }).data ?? [];
    const cachedState = participantFieldMappingsStateCacheRef.current.get(eventId)?.state;
    rememberParticipantFieldMappingsState(eventId, { has_mapping: mappings.length > 0, has_baseline_import: cachedState?.has_baseline_import ?? false, mappings });
    return mappings;
  }, [applyOnlineOnly, getAuthHeaders, rememberParticipantFieldMappingsState]);
  const runParticipantImport = useCallback(async (eventId: string, csvContent: string) => {
    const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-imports/run`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ csv_content: csvContent }) }))).payload as { data?: Record<string, unknown> };
    const data = payload.data ?? {}; const createdParticipants = Array.isArray(data.participants) ? data.participants.map((participant: ApiParticipant) => mapApiParticipantToUi(participant, eventId)) : []; setParticipantRecords(previous => [...previous, ...createdParticipants]); if (createdParticipants.length > 0) addLog(`Import CSV (${createdParticipants.length} uczestników)`);
    if (createdParticipants.length > 0) {
      markParticipantImportBaselineCache(eventId);
    } else {
      participantFieldMappingsStateCacheRef.current.delete(eventId);
    }
    return {
      created_count: Number(data.created_count ?? 0),
      duplicate_count: Number(data.duplicate_count ?? 0),
      invalid_count: Number(data.invalid_count ?? 0),
      invalid_rows: Array.isArray(data.invalid_rows) ? data.invalid_rows.map((row: number) => Number(row)) : [],
      invalid_row_details: mapParticipantImportRowIssues(data.invalid_row_details),
      duplicate_row_details: mapParticipantImportRowIssues(data.duplicate_row_details),
      participants: createdParticipants,
    };
  }, [addLog, applyOnlineOnly, getAuthHeaders, markParticipantImportBaselineCache]);
  const replaceParticipantImport = useCallback(async (eventId: string, csvContent: string, mapping: ParticipantImportMappingPayload, confirmQrSent = false) => {
    const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-imports/replace`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ csv_content: csvContent, mapping, confirm_qr_sent: confirmQrSent }),
      timeoutMs: 120_000,
    }))).payload as { data?: Record<string, unknown> };
    const data = payload.data ?? {};
    const importedParticipants = Array.isArray(data.participants) ? data.participants.map((participant: ApiParticipant) => mapApiParticipantToUi(participant, eventId)) : [];
    setParticipantRecords(previous => [...previous.filter(participant => participant.event_id !== eventId), ...importedParticipants]);
    participantFieldMappingsCacheRef.current.delete(eventId);
    participantFieldMappingsStateCacheRef.current.delete(eventId);
    participantFieldMappingsFailureUntilRef.current.delete(eventId);
    addLog(`Podmieniono listę uczestników z CSV (${importedParticipants.length} uczestników)`);
    await loadBootstrap(true);
    return {
      created_count: Number(data.created_count ?? 0),
      duplicate_count: Number(data.duplicate_count ?? 0),
      invalid_count: Number(data.invalid_count ?? 0),
      invalid_rows: Array.isArray(data.invalid_rows) ? data.invalid_rows.map((row: number) => Number(row)) : [],
      invalid_row_details: mapParticipantImportRowIssues(data.invalid_row_details),
      duplicate_row_details: mapParticipantImportRowIssues(data.duplicate_row_details),
      participants: importedParticipants,
      reset: data.reset && typeof data.reset === 'object' ? data.reset as Record<string, unknown> : undefined,
    };
  }, [addLog, applyOnlineOnly, getAuthHeaders, loadBootstrap]);
  const resetEventParticipantList = useCallback(async (eventId: string, confirmQrSent = false): Promise<ParticipantListResetResult> => {
    try {
      const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError, deleted_participant_count: 0, deleted_mapping_count: 0, deleted_baseline_record_count: 0, deleted_change_log_count: 0 };
      const payload = (await fetchJson(`${API_BASE_URL}/events/${eventId}/participant-list`, {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ confirm_qr_sent: confirmQrSent }),
      })).payload as { data?: Record<string, unknown> };
      const data = payload.data ?? {};
      setParticipantRecords(previous => previous.filter(participant => participant.event_id !== eventId));
      participantFieldMappingsCacheRef.current.delete(eventId);
      participantFieldMappingsStateCacheRef.current.delete(eventId);
      participantFieldMappingsFailureUntilRef.current.delete(eventId);
      addLog('Usunięto listę uczestników wydarzenia');
      await loadBootstrap(true);
      return {
        ok: true,
        deleted_participant_count: Number(data.deleted_participant_count ?? 0),
        deleted_mapping_count: Number(data.deleted_mapping_count ?? 0),
        deleted_baseline_record_count: Number(data.deleted_baseline_record_count ?? 0),
        deleted_change_log_count: Number(data.deleted_change_log_count ?? 0),
      };
    } catch (error) {
      handleNetworkFailure(error);
      if (isApiResponseError(error) && getApiErrorCode(error) === 'qr_emails_sent') {
        const payload = error.payload as { data?: { sent_qr_email_count?: number } };
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
        error: error instanceof Error ? error.message : 'Nie udało się usunąć listy uczestników.',
        deleted_participant_count: 0,
        deleted_mapping_count: 0,
        deleted_baseline_record_count: 0,
        deleted_change_log_count: 0,
      };
    }
  }, [addLog, ensureOnline, getAuthHeaders, handleNetworkFailure, loadBootstrap]);
  const getParticipantFieldMappings = useCallback(async (eventId: string) => {
    const cachedEntry = participantFieldMappingsCacheRef.current.get(eventId);
    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS) {
      return cachedEntry.mappings;
    }

    const cooldownUntil = participantFieldMappingsFailureUntilRef.current.get(eventId) ?? 0;
    if (cooldownUntil > Date.now()) {
      if (cachedEntry) return cachedEntry.mappings;
      throw new Error('Trwa ponowne nawiązywanie połączenia z serwerem. Spróbuj ponownie za chwilę.');
    }

    const pendingRequest = participantFieldMappingsInFlightRef.current.get(eventId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      try {
        const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-field-mappings`, { headers: getAuthHeaders() }), 'Mapowanie pól uczestników jest dostępne tylko po połączeniu z serwerem.')).payload as { data?: { mappings?: ParticipantFieldMapping[] } };
        const mappings = payload.data?.mappings ?? [];
        participantFieldMappingsCacheRef.current.set(eventId, { fetchedAt: Date.now(), mappings });
        participantFieldMappingsFailureUntilRef.current.delete(eventId);
        return mappings;
      } catch (error) {
        if (isNetworkRequestError(error)) {
          participantFieldMappingsFailureUntilRef.current.set(eventId, Date.now() + PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS);
        }
        throw error;
      } finally {
        participantFieldMappingsInFlightRef.current.delete(eventId);
      }
    })();

    participantFieldMappingsInFlightRef.current.set(eventId, request);
    return request;
  }, [applyOnlineOnly, getAuthHeaders]);
  const getParticipantFieldMappingsState = useCallback(async (eventId: string): Promise<ParticipantFieldMappingsState> => {
    const cachedEntry = participantFieldMappingsStateCacheRef.current.get(eventId);
    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS) {
      return cachedEntry.state;
    }

    const cooldownUntil = participantFieldMappingsFailureUntilRef.current.get(eventId) ?? 0;
    if (cooldownUntil > Date.now()) {
      if (cachedEntry) return cachedEntry.state;
      throw new Error('Trwa ponowne nawiązywanie połączenia z serwerem. Spróbuj ponownie za chwilę.');
    }

    const pendingRequest = participantFieldMappingsStateInFlightRef.current.get(eventId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = (async () => {
      try {
        const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-field-mappings`, { headers: getAuthHeaders() }), 'Mapowanie pól uczestników jest dostępne tylko po połączeniu z serwerem.')).payload as { data?: { has_mapping?: boolean; has_baseline_import?: boolean; mappings?: ParticipantFieldMapping[] } };
        const state = {
          has_mapping: Boolean(payload.data?.has_mapping),
          has_baseline_import: Boolean(payload.data?.has_baseline_import),
          mappings: payload.data?.mappings ?? [],
        };
        participantFieldMappingsStateCacheRef.current.set(eventId, { fetchedAt: Date.now(), state });
        participantFieldMappingsCacheRef.current.set(eventId, { fetchedAt: Date.now(), mappings: state.mappings });
        participantFieldMappingsFailureUntilRef.current.delete(eventId);
        return state;
      } catch (error) {
        if (isNetworkRequestError(error)) {
          participantFieldMappingsFailureUntilRef.current.set(eventId, Date.now() + PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS);
        }
        throw error;
      } finally {
        participantFieldMappingsStateInFlightRef.current.delete(eventId);
      }
    })();

    participantFieldMappingsStateInFlightRef.current.set(eventId, request);
    return request;
  }, [applyOnlineOnly, getAuthHeaders]);

  const updateParticipantFieldMappings = useCallback(async (eventId: string, mappings: ParticipantFieldMapping[]): Promise<ParticipantFieldMappingUpdateResult> => {
    try {
      const offlineError = ensureOnline();
      if (offlineError) return { ok: false, error: offlineError, mappings: [], has_baseline_import: false };

      const payload = (await fetchJson(`${API_BASE_URL}/events/${eventId}/participant-field-mappings`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ mappings }),
      })).payload as { data?: { has_mapping?: boolean; has_baseline_import?: boolean; mappings?: ParticipantFieldMapping[] } };
      const state = {
        has_mapping: Boolean(payload.data?.has_mapping),
        has_baseline_import: Boolean(payload.data?.has_baseline_import),
        mappings: payload.data?.mappings ?? [],
      };
      rememberParticipantFieldMappingsState(eventId, state);
      addLog('Zaktualizowano mapowanie pól uczestników');
      return { ok: true, mappings: state.mappings, has_baseline_import: state.has_baseline_import };
    } catch (error) {
      handleNetworkFailure(error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udało się zapisać mapowania pól uczestników.',
        mappings: [],
        has_baseline_import: false,
      };
    }
  }, [addLog, ensureOnline, getAuthHeaders, handleNetworkFailure, rememberParticipantFieldMappingsState]);

  const addParticipantManually = useCallback(async (eventId: string, email: string, fieldValues: Record<string, string>) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/events/${eventId}/participants/manual`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ email, field_values: fieldValues }) })).payload as { data?: ApiParticipant };
    if (payload.data) { const mapped = mapApiParticipantToUi(payload.data, eventId); setParticipantRecords(previous => [...previous, mapped]); addLog('Dodano uczestnika', mapped.name); }
    return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation]);

  const createEvent = useCallback(async (eventData: EventMutationInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const organization = organizations.find(entry => entry.id === eventData.organization_id); const organizationEventCount = [...events, ...archivedEvents].filter(event => event.organization_id === eventData.organization_id).length;
    if (organization && organizationEventCount >= organization.event_limit) return { ok: false, error: 'Limit wydarzeń dla tej organizacji został osiągnięty' };
    const payload = (await fetchJson(`${API_BASE_URL}/events`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(eventData) })).payload as { data?: ApiEvent };
    if (!payload.data) return { ok: false, error: 'API zwróciło pustą odpowiedź podczas tworzenia wydarzenia' };
    markLocalDataChanged(); setEvents(previous => [...previous, payload.data]); addLog(`Utworzono wydarzenie: ${payload.data.name}`); return { ok: true, entityId: payload.data.id };
  }), [addLog, archivedEvents, ensureOnline, events, getAuthHeaders, markLocalDataChanged, organizations, runMutation]);

  const updateEvent = useCallback(async (eventId: string, data: EventUpdateInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/events/${eventId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiEvent };
    if (!payload.data) return { ok: false, error: 'API zwróciło pustą odpowiedź podczas aktualizacji wydarzenia' };
    markLocalDataChanged(); setEvents(previous => previous.map(event => event.id === eventId ? payload.data! : event)); addLog(`Zaktualizowano wydarzenie: ${payload.data.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, markLocalDataChanged, runMutation]);

  const archiveEvent = useCallback(async (eventId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingEvent = events.find(event => event.id === eventId);
    const eventOfficeCloseAt = existingEvent ? getEventOfficeCloseAt(existingEvent) : null;
    if (eventOfficeCloseAt === null || Date.now() <= eventOfficeCloseAt.getTime()) return { ok: false, error: 'Do archiwum można przenieść tylko zakończone wydarzenia' };
    await fetchJson(`${API_BASE_URL}/events/${eventId}/archive`, { method: 'POST', headers: getAuthHeaders() }); markLocalDataChanged(); setEvents(previous => previous.filter(event => event.id !== eventId)); if (existingEvent) setArchivedEvents(previous => [{ ...existingEvent, archived_at: new Date().toISOString() }, ...previous]); if (selectedEventId === eventId) setSelectedEventId(''); if (existingEvent) addLog(`Zarchiwizowano wydarzenie: ${existingEvent.name}`); await loadBootstrap(true); return { ok: true };
  }), [addLog, ensureOnline, events, getAuthHeaders, loadBootstrap, markLocalDataChanged, runMutation, selectedEventId, setSelectedEventId]);

  const deleteEvent = useCallback(async (eventId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingEvent = events.find(event => event.id === eventId);
    const eventOfficeCloseAt = existingEvent ? getEventOfficeCloseAt(existingEvent) : null;
    if (eventOfficeCloseAt !== null && Date.now() > eventOfficeCloseAt.getTime()) return { ok: false, error: 'Zakończone wydarzenia trzeba przenieść do archiwum zamiast usuwać' };
    await fetchJson(`${API_BASE_URL}/events/${eventId}/delete-ui`, { method: 'POST', headers: getAuthHeaders() }); markLocalDataChanged(); setEvents(previous => previous.filter(event => event.id !== eventId)); if (selectedEventId === eventId) setSelectedEventId(''); if (existingEvent) addLog(`Usunięto wydarzenie: ${existingEvent.name}`); await loadBootstrap(true); return { ok: true };
  }), [addLog, ensureOnline, events, getAuthHeaders, loadBootstrap, markLocalDataChanged, runMutation, selectedEventId, setSelectedEventId]);

  const addUser = useCallback(async (userData: UserCreateInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const createUserPayload: Record<string, unknown> = { name: userData.name, email: userData.email, role: userData.role, organization_id: userData.organization_id, assigned_events: userData.assigned_events };
    if (userData.password) createUserPayload.password = userData.password;
    const payload = (await fetchJson(`${API_BASE_URL}/users`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(createUserPayload) })).payload as { data?: ApiUser };
    if (!payload.data) return { ok: false, error: 'API user create returned empty payload' };
    markLocalDataChanged(); const createdUser = mapApiUserToUi(payload.data); setUsers(previous => [...previous, createdUser]); addLog(`Dodano użytkownika: ${createdUser.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, markLocalDataChanged, runMutation]);

  const updateUser = useCallback(async (userId: string, data: UserUpdateInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/users/${userId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiUser };
    if (!payload.data) return { ok: false, error: 'API user update returned empty payload' };
    markLocalDataChanged(); const updatedUser = mapApiUserToUi(payload.data); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true };
  }), [ensureOnline, getAuthHeaders, markLocalDataChanged, runMutation, syncStoredAuthUser]);

  const createOrganization = useCallback(async (data: { name: string; event_limit: number }) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/organizations`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiOrganization };
    if (!payload.data) return { ok: false, error: 'API organization create returned empty payload' };
    const createdOrganization = mapApiOrganizationToUi(payload.data);
    markLocalDataChanged(); setOrganizations(previous => [...previous, createdOrganization]); return { ok: true, entityId: createdOrganization.id };
  }), [ensureOnline, getAuthHeaders, markLocalDataChanged, runMutation]);

  const updateOrganization = useCallback(async (organizationId: string, data: OrganizationUpdateInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/organizations/${organizationId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiOrganization };
    if (!payload.data) return { ok: false, error: 'API organization update returned empty payload' };
    const updatedOrganization = mapApiOrganizationToUi(payload.data);
    setOrganizations(previous => previous.map(organization => organization.id === organizationId ? updatedOrganization : organization)); if (data.name) addLog(`Zaktualizowano organizację: ${updatedOrganization.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation]);

  const updateOrganizationEventLimit = useCallback(async (organizationId: string, eventLimit: number) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const assignedEventsCount = events.filter(event => event.organization_id === organizationId).length; if (eventLimit < assignedEventsCount) return { ok: false, error: `Limit wydarzeń nie może być mniejszy niż ${assignedEventsCount}, bo tyle wydarzeń jest już przypisanych do tej organizacji.` };
    const payload = (await fetchJson(`${API_BASE_URL}/organizations/${organizationId}/event-limit`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ event_limit: eventLimit }) })).payload as { data?: ApiOrganization };
    if (!payload.data) return { ok: false, error: 'API organization update returned empty payload' };
    const updatedOrganization = mapApiOrganizationToUi(payload.data);
    setOrganizations(previous => previous.map(organization => organization.id === organizationId ? updatedOrganization : organization)); await loadBootstrap(true); return { ok: true };
  }), [ensureOnline, events, getAuthHeaders, loadBootstrap, runMutation]);

  const deleteOrganization = useCallback(async (organizationId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingOrganization = organizations.find(organization => organization.id === organizationId); await fetchJson(`${API_BASE_URL}/organizations/${organizationId}`, { method: 'DELETE', headers: getAuthHeaders() }); setOrganizations(previous => previous.filter(organization => organization.id !== organizationId)); if (existingOrganization) addLog(`Usunięto organizację: ${existingOrganization.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, organizations, runMutation]);

  const assignScannerEvents = useCallback(async (userId: string, eventIds: string[]) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/users/${userId}/event-assignments`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify({ assigned_events: eventIds }) })).payload as { data?: ApiUser };
    if (!payload.data) return { ok: false, error: 'API scanner assignment returned empty payload' };
    markLocalDataChanged(); const updatedUser = mapApiUserToUi(payload.data); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true };
  }), [ensureOnline, getAuthHeaders, markLocalDataChanged, runMutation, syncStoredAuthUser]);

  const removeUser = useCallback(async (id: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingUser = users.find(user => user.id === id); await fetchJson(`${API_BASE_URL}/users/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); setUsers(previous => previous.filter(user => user.id !== id)); if (existingUser) addLog(`Usunięto użytkownika: ${existingUser.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation, users]);

  const triggerUserPasswordReset = useCallback(async (id: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingUser = users.find(user => user.id === id); await fetchJson(`${API_BASE_URL}/users/${id}/password-reset`, { method: 'POST', headers: getAuthHeaders() }); if (existingUser) addLog(`Wysłano reset hasła użytkownikowi: ${existingUser.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation, users]);

  const setUserPassword = useCallback(async (id: string, password: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingUser = users.find(user => user.id === id);
    await fetchJson(`${API_BASE_URL}/users/${id}/password`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify({ password }) });
    if (existingUser) addLog(`Ustawiono hasło użytkownikowi: ${existingUser.name}`);
    return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation, users]);

  const changeRole = useCallback(async (userId: string, role: Role) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/users/${userId}/role`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify({ role }) })).payload as { data?: ApiUser };
    if (!payload.data) return { ok: false, error: 'API user role change returned empty payload' };
    const updatedUser = mapApiUserToUi(payload.data); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true };
  }), [ensureOnline, getAuthHeaders, runMutation, syncStoredAuthUser]);

  const sendParticipantQrEmail = useCallback(async (participantId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}/send-qr-email`, { method: 'POST', headers: getAuthHeaders() })).payload as { data?: ApiParticipant };
    if (!payload.data) return { ok: false, error: 'API QR email send failed' };
    replaceParticipantRecord(mapApiParticipantToUi(payload.data, participants.find(participant => participant.id === participantId)?.event_id ?? '')); await loadBootstrap(true); return { ok: true };
  }), [ensureOnline, getAuthHeaders, loadBootstrap, participants, replaceParticipantRecord, runMutation]);

  const sendEventQrEmails = useCallback(async (eventId: string, resendAll = false): Promise<EventQrEmailResult> => {
    try {
      const offlineError = ensureOnline(); if (offlineError) return { ok: false, sent_count: 0, error_count: 0, errors: [], error: offlineError };
      const payload = (await fetchJson(`${API_BASE_URL}/events/${eventId}/send-qr-emails`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ resend_all: resendAll }),
        timeoutMs: 120_000,
      })).payload as { data?: { sent_count?: number; error_count?: number; errors?: Array<{ participant_id: number; participant_name: string; error: string }> } };
      await loadBootstrap(true);
      return { ok: true, sent_count: Number(payload.data?.sent_count ?? 0), error_count: Number(payload.data?.error_count ?? 0), errors: Array.isArray(payload.data?.errors) ? payload.data!.errors : [] };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, sent_count: 0, error_count: 0, errors: [], error: error instanceof Error ? error.message : 'Nie udało się wysłać kodów QR.' };
    }
  }, [ensureOnline, getAuthHeaders, handleNetworkFailure, loadBootstrap]);

  const getParticipantQrPreview = useCallback(async (participantId: string) => {
    const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}/qr-preview`, { headers: getAuthHeaders() }), 'Podgląd QR jest dostępny tylko po połączeniu z serwerem.')).payload as ParticipantQrPreviewResponse;
    if (!payload.data?.participant || !payload.data.event) throw new Error('API QR preview failed');
    return { participant: mapApiParticipantToUi(payload.data.participant, payload.data.event.id), event: payload.data.event, qr_code_svg_data_uri: payload.data.qr_code_svg_data_uri ?? '', qr_code_image_url: payload.data.qr_code_image_url ?? '' };
  }, [applyOnlineOnly, getAuthHeaders]);

  const scanParticipantQr = useCallback(async (qrCode: string) => {
    const normalizedQrCode = qrCode.trim();
    if (!normalizedQrCode) return { ok: false, error: 'Kod QR jest pusty.', status: 422 };
    const localParticipant = participants.find(participant => participant.event_id === selectedEventId && participant.qr_code === normalizedQrCode);
    const localEvent = events.find(event => event.id === selectedEventId) ?? archivedEvents.find(event => event.id === selectedEventId);
    if (localParticipant && localEvent) return { ok: true, data: { participant: localParticipant, event: localEvent, access: { allowed: true } }, status: 200 };
    if (connectionState !== 'online') return { ok: false, error: 'Nie znaleziono uczestnika w lokalnym snapshotcie wydarzenia.', status: 404 };
    try {
      const response = await fetchJson(`${API_BASE_URL}/participants/scan`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ qr_code: normalizedQrCode }) });
      const payload = response.payload as ParticipantScanApiResponse;
      if (!payload.data?.participant || !payload.data.event) return { ok: false, error: 'Nie znaleziono uczestnika dla tego kodu QR.', status: response.response.status };
      return { ok: true, data: { participant: mapApiParticipantToUi(payload.data.participant, payload.data.event.id), event: payload.data.event, access: { allowed: Boolean(payload.data.access?.allowed) } }, status: response.response.status };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: normalizeScanParticipantErrorMessage(error), status: isApiResponseError(error) ? error.status : 0 };
    }
  }, [archivedEvents, connectionState, events, getAuthHeaders, handleNetworkFailure, participants, selectedEventId]);

  const deleteParticipant = useCallback(async (participantId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingParticipant = participants.find(participant => participant.id === participantId); await fetchJson(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`, { method: 'DELETE', headers: getAuthHeaders() }); setParticipantRecords(previous => previous.filter(participant => participant.id !== participantId)); if (existingParticipant) addLog('Usunięto uczestnika', existingParticipant.name); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, participants, runMutation]);

  const buildExportFallbackName = useCallback((eventId: string, type: 'uczestnicy' | 'logi' | 'zmiany') => {
    const event = events.find(entry => entry.id === eventId) ?? archivedEvents.find(entry => entry.id === eventId);
    const eventName = event?.name ?? 'wydarzenie';
    const slug = eventName
      .replace(/[ąćęłńóśźż]/g, letter => ({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' }[letter] ?? letter))
      .replace(/[ĄĆĘŁŃÓŚŹŻ]/g, letter => ({ Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' }[letter] ?? letter))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/g, '') || 'wydarzenie';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    return `bz-${type}-${slug}-${date}.csv`;
  }, [archivedEvents, events]);

  const downloadCsvResponse = useCallback(async (response: Response, fallbackName: string) => {
    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') ?? '';
    const utf8FileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    const quotedFileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const fileName = utf8FileNameMatch?.[1]
      ? decodeURIComponent(utf8FileNameMatch[1])
      : quotedFileNameMatch?.[1] ?? fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }, []);

  const exportEventCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; return { ok: false, error: payload.error ?? `Eksport wydarzenia nie powiódł się: ${response.status}` }; }
      await downloadCsvResponse(response, buildExportFallbackName(eventId, 'uczestnicy')); return { ok: true };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować CSV' };
    }
  }, [buildExportFallbackName, downloadCsvResponse, ensureOnline, getAuthHeaders, handleNetworkFailure]);

  const exportEventLogsCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/logs/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; return { ok: false, error: payload.error ?? `Eksport logów wydarzenia nie powiódł się: ${response.status}` }; }
      await downloadCsvResponse(response, buildExportFallbackName(eventId, 'logi')); return { ok: true };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować logów CSV' };
    }
  }, [buildExportFallbackName, downloadCsvResponse, ensureOnline, getAuthHeaders, handleNetworkFailure]);

  const exportEventParticipantChangesCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-changes/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; return { ok: false, error: payload.error ?? `Eksport zmian uczestników nie powiódł się: ${response.status}` }; }
      await downloadCsvResponse(response, buildExportFallbackName(eventId, 'zmiany')); return { ok: true };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować CSV zmian uczestników' };
    }
  }, [buildExportFallbackName, downloadCsvResponse, ensureOnline, getAuthHeaders, handleNetworkFailure]);

  return (
    <DataContext.Provider value={{ organizations, events, archivedEvents, participants, users, activityLog, currentRole, currentUser, selectedOrganizationId, setSelectedOrganizationId, selectedEventId, setSelectedEventId, selectEventContext, updateParticipantStatus, updateParticipantBibNumber, updateParticipantDetails, analyzeParticipantImport, confirmParticipantImportMapping, runParticipantImport, replaceParticipantImport, resetEventParticipantList, getParticipantFieldMappingsState, getParticipantFieldMappings, updateParticipantFieldMappings, addParticipantManually, createEvent, updateEvent, archiveEvent, deleteEvent, addUser, updateUser, createOrganization, updateOrganization, updateOrganizationEventLimit, deleteOrganization, removeUser, triggerUserPasswordReset, setUserPassword, changeRole, assignScannerEvents, sendParticipantQrEmail, sendEventQrEmails, getParticipantQrPreview, scanParticipantQr, deleteParticipant, exportEventCsv, exportEventLogsCsv, exportEventParticipantChangesCsv, visibleEvents, canAccessEvent, canViewEvent, isLoading, connectionState, lastSyncAt, snapshotSource, pendingMutationCount, scannerMode, diagnostics, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
