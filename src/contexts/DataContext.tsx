import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityLog, ConnectionState, Event, Organization, Participant, ParticipantFieldMapping, ParticipantQrPreview, ParticipantScanResult, ParticipantStatus, Role, ScannerMode, SnapshotSource, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, fetchJson, getApiErrorCode, isApiResponseError, isNetworkRequestError } from '@/lib/api';
import { type ApiEvent, type ApiOrganization, type ApiParticipant, type ApiUser, type BootstrapResponse, type ParticipantQrPreviewResponse, type ParticipantScanApiResponse, OFFLINE_ACTION_MESSAGE, applyPendingMutations, buildOfflineSnapshot, createBootstrapSnapshotVersion, createClientMutationId, extractConflictParticipant, getDefaultCurrentUser, getDeviceId, getInitialConnectionState, getSelectableOrganizationsForUser, getVisibleEventsForUser, mapApiOrganizationToUi, mapApiParticipantToUi, mapApiUserToUi, participantUiIdToApiId, persistStoredSelectedEventId, persistStoredSelectedOrganizationId, readStoredSelectedEventId, readStoredSelectedOrganizationId, resolveSelectedEventId, resolveSelectedOrganizationId } from '@/lib/data-context-helpers';
import { deletePendingMutation, loadBootstrapSnapshot, loadPendingMutations, loadSyncMeta, saveBootstrapSnapshot, savePendingMutation, saveSyncMeta, updatePendingMutation, type PendingParticipantMutation } from '@/lib/offline-store';
import { isEventOfficeOpen } from '@/lib/events';

type UserCreateInput = Omit<User, 'id' | 'password'>;
type EventMutationInput = Omit<Event, 'id' | 'archived_at'>;

interface MutationResult { ok: boolean; error?: string; entityId?: string; }
interface ParticipantBibNumberConflict { bibNumber: string; conflictingParticipants: Participant[]; }
interface ParticipantBibNumberUpdateResult extends MutationResult { conflict?: ParticipantBibNumberConflict; }
interface EventQrEmailResult { ok: boolean; sent_count: number; error_count: number; errors: Array<{ participant_id: number; participant_name: string; error: string }>; error?: string; }
interface ParticipantImportAnalysis { headers: string[]; sample_rows: Record<string, string>[]; email_candidates: { column: string; matched_count: number }[]; has_mapping: boolean; mappings: ParticipantFieldMapping[]; missing_required_columns: string[]; row_count: number; }
interface ParticipantImportMappingFieldInput { source_column_name: string; alias: string; field_role: 'display_name_part' | 'bib_number' | 'custom'; is_active: boolean; }
interface ParticipantImportMappingPayload { csv_columns: string[]; email_column: string; fields: ParticipantImportMappingFieldInput[]; }
interface ParticipantImportRunResult { created_count: number; duplicate_count: number; invalid_count: number; invalid_rows: number[]; participants: Participant[]; }
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
  updateParticipantStatus: (participantId: string, status: ParticipantStatus, options?: ParticipantUpdateOptions) => Promise<MutationResult>;
  updateParticipantBibNumber: (participantId: string, bibNumber: string, options?: ParticipantBibNumberUpdateOptions) => Promise<ParticipantBibNumberUpdateResult>;
  updateParticipantDetails: (participantId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  analyzeParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportAnalysis>;
  confirmParticipantImportMapping: (eventId: string, payload: ParticipantImportMappingPayload) => Promise<ParticipantFieldMapping[]>;
  runParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportRunResult>;
  getParticipantFieldMappings: (eventId: string) => Promise<ParticipantFieldMapping[]>;
  addParticipantManually: (eventId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  createEvent: (e: EventMutationInput) => Promise<MutationResult>;
  updateEvent: (eventId: string, data: EventMutationInput) => Promise<MutationResult>;
  deleteEvent: (eventId: string) => Promise<MutationResult>;
  addUser: (u: UserCreateInput) => Promise<MutationResult>;
  updateUser: (userId: string, data: UserUpdateInput) => Promise<MutationResult>;
  createOrganization: (data: { name: string; event_limit: number }) => Promise<MutationResult>;
  updateOrganization: (organizationId: string, data: OrganizationUpdateInput) => Promise<MutationResult>;
  updateOrganizationEventLimit: (organizationId: string, eventLimit: number) => Promise<MutationResult>;
  deleteOrganization: (organizationId: string) => Promise<MutationResult>;
  removeUser: (id: string) => Promise<MutationResult>;
  triggerUserPasswordReset: (id: string) => Promise<MutationResult>;
  changeRole: (userId: string, role: Role) => Promise<MutationResult>;
  assignScannerEvents: (userId: string, eventIds: string[]) => Promise<MutationResult>;
  sendParticipantQrEmail: (participantId: string) => Promise<MutationResult>;
  sendEventQrEmails: (eventId: string, resendAll?: boolean) => Promise<EventQrEmailResult>;
  getParticipantQrPreview: (participantId: string) => Promise<ParticipantQrPreview>;
  scanParticipantQr: (qrCode: string) => Promise<{ ok: boolean; data?: ParticipantScanResult; error?: string; status?: number }>;
  deleteParticipant: (participantId: string) => Promise<MutationResult>;
  exportEventCsv: (eventId: string) => Promise<MutationResult>;
  exportEventLogsCsv: (eventId: string) => Promise<MutationResult>;
  visibleEvents: Event[];
  canAccessEvent: (eventId: string) => boolean;
  canViewEvent: (eventId: string) => boolean;
  isLoading: boolean;
  connectionState: ConnectionState;
  lastSyncAt: string | null;
  snapshotSource: SnapshotSource;
  pendingMutationCount: number;
  scannerMode: ScannerMode;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);
const OFFLINE_MUTATION_LIMIT = 20;
const OFFLINE_MUTATION_WINDOW_MS = 60_000;
const CONNECTION_RECOVERY_INTERVAL_MS = 15_000;
const NETWORK_FAILURE_THRESHOLD = 2;
const PARTICIPANT_FIELD_MAPPINGS_CACHE_TTL_MS = 60_000;
const PARTICIPANT_FIELD_MAPPINGS_FAILURE_COOLDOWN_MS = 10_000;

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
  const syncRef = useRef(false);
  const networkFailureCountRef = useRef(0);
  const participantFieldMappingsCacheRef = useRef(new Map<string, { fetchedAt: number; mappings: ParticipantFieldMapping[] }>());
  const participantFieldMappingsInFlightRef = useRef(new Map<string, Promise<ParticipantFieldMapping[]>>());
  const participantFieldMappingsFailureUntilRef = useRef(new Map<string, number>());

  const participants = useMemo(() => applyPendingMutations(participantRecords, pendingMutations), [participantRecords, pendingMutations]);
  const currentUser = useMemo(() => !authUser ? getDefaultCurrentUser() : users.find(user => user.id === authUser.id) || authUser, [users, authUser]);
  const currentRole = currentUser.role;
  const visibleEvents = useMemo(() => getVisibleEventsForUser(events, currentUser, new Date(nowTimestamp)), [events, currentUser, nowTimestamp]);
  const selectableOrganizations = useMemo(() => getSelectableOrganizationsForUser(organizations, currentUser), [organizations, currentUser]);
  const eventSelectionScope = useMemo(() => currentRole !== 'admin' ? visibleEvents : selectedOrganizationId ? visibleEvents.filter(event => event.organization_id === selectedOrganizationId) : [], [currentRole, selectedOrganizationId, visibleEvents]);
  const pendingMutationCount = useMemo(() => pendingMutations.filter(mutation => mutation.state === 'queued').length, [pendingMutations]);
  const offlineDurationMs = useMemo(() => !offlineSinceAt ? 0 : Math.max(0, nowTimestamp - new Date(offlineSinceAt).getTime()), [nowTimestamp, offlineSinceAt]);
  const scannerMode = useMemo<ScannerMode>(() => connectionState === 'online' ? 'online' : (offlineDurationMs > OFFLINE_MUTATION_WINDOW_MS || pendingMutationCount > OFFLINE_MUTATION_LIMIT ? 'read_only' : 'offline_queue'), [connectionState, offlineDurationMs, pendingMutationCount]);

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

  const syncStoredAuthUser = useCallback((updater: (user: User) => User) => {
    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) return;
      sessionStorage.setItem('auth_user', JSON.stringify(updater(JSON.parse(raw) as User)));
    } catch {}
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

  const hydrateData = useCallback((responseData: BootstrapResponse['data'], source: SnapshotSource, generatedAt: string, preferredOrganizationId = '', preferredEventId = '') => {
    if (!authUser) return;
    const nextOrganizations = Array.isArray(responseData.organizations) ? responseData.organizations.map(mapApiOrganizationToUi) : [];
    const nextEvents = Array.isArray(responseData.events) ? responseData.events : [];
    const nextArchivedEvents = Array.isArray(responseData.archivedEvents) ? responseData.archivedEvents : [];
    const nextUsers = (responseData.users ?? []).map(mapApiUserToUi);
    const nextCurrentUser = nextUsers.find(user => user.id === authUser.id) ?? authUser;
    const nextVisibleEvents = getVisibleEventsForUser(nextEvents, nextCurrentUser);
    const nextSelectableOrganizations = getSelectableOrganizationsForUser(nextOrganizations, nextCurrentUser);
    const preferredOrg = readStoredSelectedOrganizationId(authUser.id) || preferredOrganizationId;
    const nextSelectedOrganization = nextCurrentUser.role === 'admin' ? resolveSelectedOrganizationId(nextSelectableOrganizations, preferredOrg) : '';
    const scopedEvents = nextCurrentUser.role === 'admin' ? nextVisibleEvents.filter(event => event.organization_id === nextSelectedOrganization) : nextVisibleEvents;
    const preferredEvt = readStoredSelectedEventId(authUser.id) || preferredEventId;
    const nextSelectedEvent = resolveSelectedEventId(scopedEvents, preferredEvt);
    const nextParticipants = (responseData.participants ?? []).map(participant => mapApiParticipantToUi(participant, nextSelectedEvent));
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
    if (!silent) setIsLoading(true);
    if (!authUser || !token) { resetState(); setIsLoading(false); return; }
    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/bootstrap`, { headers: getAuthHeaders() });
      const response = payload as BootstrapResponse;
      const generatedAt = response.generated_at ?? new Date().toISOString();
      const snapshotVersion = response.snapshot_version ?? createBootstrapSnapshotVersion(response.data);
      hydrateData(response.data, 'network', generatedAt);
      markConnectionHealthy();
      await saveBootstrapSnapshot(buildOfflineSnapshot({ userId: authUser.id, selectedOrganizationId: readStoredSelectedOrganizationId(authUser.id), selectedEventId: readStoredSelectedEventId(authUser.id), organizations: Array.isArray(response.data.organizations) ? response.data.organizations.map(mapApiOrganizationToUi) : [], events: Array.isArray(response.data.events) ? response.data.events : [], archivedEvents: Array.isArray(response.data.archivedEvents) ? response.data.archivedEvents : [], users: (response.data.users ?? []).map(mapApiUserToUi), participants: (response.data.participants ?? []).map(participant => mapApiParticipantToUi(participant, readStoredSelectedEventId(authUser.id))), activityLog: Array.isArray(response.data.activityLog) ? response.data.activityLog : [], generatedAt, snapshotVersion }));
      await updateSyncMeta(authUser.id, generatedAt, null);
    } catch (error) {
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
  useEffect(() => { if (currentRole !== 'admin') { if (selectedOrganizationId !== '') setSelectedOrganizationId(''); return; } const nextSelectedOrganizationId = resolveSelectedOrganizationId(selectableOrganizations, selectedOrganizationId); if (nextSelectedOrganizationId !== selectedOrganizationId) setSelectedOrganizationId(nextSelectedOrganizationId); }, [currentRole, selectableOrganizations, selectedOrganizationId, setSelectedOrganizationId]);
  useEffect(() => { const nextVisibleEventId = eventSelectionScope[0]?.id ?? ''; if (eventSelectionScope.some(event => event.id === selectedEventId) || nextVisibleEventId === selectedEventId) return; setSelectedEventId(nextVisibleEventId); }, [eventSelectionScope, selectedEventId, setSelectedEventId]);

  const canAccessEvent = useCallback((eventId: string) => {
    const event = events.find(entry => entry.id === eventId) ?? archivedEvents.find(entry => entry.id === eventId);
    if (!event) return false;
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
    return mapApiParticipantToUi(payload.data, selectedEventId);
  }, [getAuthHeaders, selectedEventId]);

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

  const queueStatusUpdate = useCallback(async (participantId: string, status: ParticipantStatus): Promise<MutationResult> => {
    const participant = participants.find(item => item.id === participantId);
    if (!participant) return { ok: false, error: 'Nie znaleziono uczestnika.' };
    if (scannerMode === 'read_only' && connectionState !== 'online') return { ok: false, error: 'Skaner jest teraz tylko do odczytu, bo dane są zbyt stare albo kolejka zmian jest zbyt długa.' };
    const mutation: PendingParticipantMutation = { id: createClientMutationId(), apiBaseUrl: API_BASE_URL, userId: authUser?.id ?? 'unknown', participantId: participant.id, participantApiId: participantUiIdToApiId(participant.id), eventId: participant.event_id, nextStatus: status, baseStatus: participant.status, queuedAt: new Date().toISOString(), deviceId: getDeviceId(), state: 'queued', attempts: 0 };
    await savePendingMutation(mutation);
    setPendingMutations(previous => [...previous, mutation]);
    addLog('Zmieniono status uczestnika (oczekuje na synchronizację)', participant.name);
    if (connectionState === 'online') void syncPendingMutations();
    else setDegradedState();
    return { ok: true };
  }, [addLog, authUser?.id, connectionState, participants, scannerMode, setDegradedState, syncPendingMutations]);

  useEffect(() => { if (connectionState === 'online' && pendingMutations.some(mutation => mutation.state === 'queued')) void syncPendingMutations(); }, [connectionState, pendingMutations, syncPendingMutations]);

  const updateParticipantStatus = useCallback(async (participantId: string, status: ParticipantStatus, options?: ParticipantUpdateOptions) => {
    if (options?.allowOfflineQueue) return queueStatusUpdate(participantId, status);
    return runMutation(async () => {
      const offlineError = ensureOnline('Zmiana statusu uczestnika jest dostępna tylko po połączeniu z serwerem.');
      if (offlineError) return { ok: false, error: offlineError };
      const participant = await updateParticipantInApi(participantId, { status });
      replaceParticipantRecord(participant);
      await loadBootstrap(true);
      return { ok: true };
    });
  }, [ensureOnline, loadBootstrap, queueStatusUpdate, replaceParticipantRecord, runMutation, updateParticipantInApi]);

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
    const offlineError = ensureOnline('Zmiana numeru startowego jest dostępna tylko po poĹ‚ączeniu z serwerem.');
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
              ? payload.data.conflicting_participants.map(conflictParticipant => mapApiParticipantToUi(conflictParticipant, selectedEventId))
              : [],
          },
        };
      }

      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zapisać numeru startowego.' };
    }
  }, [ensureOnline, handleNetworkFailure, loadBootstrap, replaceParticipantRecord, selectedEventId, updateParticipantInApi]);

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
  const confirmParticipantImportMapping = useCallback(async (eventId: string, payload: ParticipantImportMappingPayload) => {
    const mappings = ((await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-imports/confirm`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(payload) }))).payload as { data?: ParticipantFieldMapping[] }).data ?? [];
    participantFieldMappingsCacheRef.current.set(eventId, { fetchedAt: Date.now(), mappings });
    participantFieldMappingsFailureUntilRef.current.delete(eventId);
    return mappings;
  }, [applyOnlineOnly, getAuthHeaders]);
  const runParticipantImport = useCallback(async (eventId: string, csvContent: string) => {
    const payload = (await applyOnlineOnly(async () => fetchJson(`${API_BASE_URL}/events/${eventId}/participant-imports/run`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ csv_content: csvContent }) }))).payload as { data?: Record<string, unknown> };
    const data = payload.data ?? {}; const createdParticipants = Array.isArray(data.participants) ? data.participants.map((participant: ApiParticipant) => mapApiParticipantToUi(participant, eventId)) : []; setParticipantRecords(previous => [...previous, ...createdParticipants]); if (createdParticipants.length > 0) addLog(`Import CSV (${createdParticipants.length} uczestników)`);
    return { created_count: Number(data.created_count ?? 0), duplicate_count: Number(data.duplicate_count ?? 0), invalid_count: Number(data.invalid_count ?? 0), invalid_rows: Array.isArray(data.invalid_rows) ? data.invalid_rows.map((row: number) => Number(row)) : [], participants: createdParticipants };
  }, [addLog, applyOnlineOnly, getAuthHeaders]);
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
    if (!payload.data) return { ok: false, error: 'API event create returned empty payload' };
    setEvents(previous => [...previous, payload.data]); addLog(`Utworzono wydarzenie: ${payload.data.name}`); return { ok: true };
  }), [addLog, archivedEvents, ensureOnline, events, getAuthHeaders, organizations, runMutation]);

  const updateEvent = useCallback(async (eventId: string, data: EventMutationInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/events/${eventId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiEvent };
    if (!payload.data) return { ok: false, error: 'API event update returned empty payload' };
    setEvents(previous => previous.map(event => event.id === eventId ? payload.data! : event)); addLog(`Zaktualizowano wydarzenie: ${payload.data.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation]);

  const deleteEvent = useCallback(async (eventId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingEvent = events.find(event => event.id === eventId); await fetchJson(`${API_BASE_URL}/events/${eventId}`, { method: 'DELETE', headers: getAuthHeaders() }); setEvents(previous => previous.filter(event => event.id !== eventId)); if (existingEvent) setArchivedEvents(previous => [{ ...existingEvent, archived_at: new Date().toISOString() }, ...previous]); if (selectedEventId === eventId) setSelectedEventId(''); if (existingEvent) addLog(`Zarchiwizowano wydarzenie: ${existingEvent.name}`); await loadBootstrap(true); return { ok: true };
  }), [addLog, ensureOnline, events, getAuthHeaders, loadBootstrap, runMutation, selectedEventId, setSelectedEventId]);

  const addUser = useCallback(async (userData: UserCreateInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/users`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ name: userData.name, email: userData.email, role: userData.role, organization_id: userData.organization_id, assigned_events: userData.assigned_events }) })).payload as { data?: ApiUser };
    if (!payload.data) return { ok: false, error: 'API user create returned empty payload' };
    const createdUser = mapApiUserToUi(payload.data); setUsers(previous => [...previous, createdUser]); addLog(`Dodano użytkownika: ${createdUser.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation]);

  const updateUser = useCallback(async (userId: string, data: UserUpdateInput) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/users/${userId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiUser };
    if (!payload.data) return { ok: false, error: 'API user update returned empty payload' };
    const updatedUser = mapApiUserToUi(payload.data); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true };
  }), [ensureOnline, getAuthHeaders, runMutation, syncStoredAuthUser]);

  const createOrganization = useCallback(async (data: { name: string; event_limit: number }) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const payload = (await fetchJson(`${API_BASE_URL}/organizations`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(data) })).payload as { data?: ApiOrganization };
    if (!payload.data) return { ok: false, error: 'API organization create returned empty payload' };
    const createdOrganization = mapApiOrganizationToUi(payload.data);
    setOrganizations(previous => [...previous, createdOrganization]); return { ok: true, entityId: createdOrganization.id };
  }), [ensureOnline, getAuthHeaders, runMutation]);

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
    const updatedUser = mapApiUserToUi(payload.data); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true };
  }), [ensureOnline, getAuthHeaders, runMutation, syncStoredAuthUser]);

  const removeUser = useCallback(async (id: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingUser = users.find(user => user.id === id); await fetchJson(`${API_BASE_URL}/users/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); setUsers(previous => previous.filter(user => user.id !== id)); if (existingUser) addLog(`Usunięto użytkownika: ${existingUser.name}`); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, runMutation, users]);

  const triggerUserPasswordReset = useCallback(async (id: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingUser = users.find(user => user.id === id); await fetchJson(`${API_BASE_URL}/users/${id}/password-reset`, { method: 'POST', headers: getAuthHeaders() }); if (existingUser) addLog(`Wysłano reset hasła użytkownikowi: ${existingUser.name}`); return { ok: true };
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
    replaceParticipantRecord(mapApiParticipantToUi(payload.data, selectedEventId)); await loadBootstrap(true); return { ok: true };
  }), [ensureOnline, getAuthHeaders, loadBootstrap, replaceParticipantRecord, runMutation, selectedEventId]);

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
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się odczytać uczestnika.', status: isApiResponseError(error) ? error.status : 0 };
    }
  }, [archivedEvents, connectionState, events, getAuthHeaders, handleNetworkFailure, participants, selectedEventId]);

  const deleteParticipant = useCallback(async (participantId: string) => runMutation(async () => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    const existingParticipant = participants.find(participant => participant.id === participantId); await fetchJson(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`, { method: 'DELETE', headers: getAuthHeaders() }); setParticipantRecords(previous => previous.filter(participant => participant.id !== participantId)); if (existingParticipant) addLog('Usunięto uczestnika', existingParticipant.name); return { ok: true };
  }), [addLog, ensureOnline, getAuthHeaders, participants, runMutation]);

  const exportEventCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; return { ok: false, error: payload.error ?? `API event export failed: ${response.status}` }; }
      const blob = await response.blob(); const fallbackName = `event-${eventId}-participants.csv`; const contentDisposition = response.headers.get('content-disposition') ?? ''; const fileNameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i); const fileName = fileNameMatch?.[1] ?? fallbackName; const objectUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = objectUrl; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl); return { ok: true };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować CSV' };
    }
  }, [ensureOnline, getAuthHeaders, handleNetworkFailure]);

  const exportEventLogsCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    const offlineError = ensureOnline(); if (offlineError) return { ok: false, error: offlineError };
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/logs/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; return { ok: false, error: payload.error ?? `API event logs export failed: ${response.status}` }; }
      const blob = await response.blob(); const fallbackName = `event-${eventId}-logs.csv`; const contentDisposition = response.headers.get('content-disposition') ?? ''; const fileNameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i); const fileName = fileNameMatch?.[1] ?? fallbackName; const objectUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = objectUrl; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl); return { ok: true };
    } catch (error) {
      handleNetworkFailure(error);
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować logów CSV' };
    }
  }, [ensureOnline, getAuthHeaders, handleNetworkFailure]);

  return (
    <DataContext.Provider value={{ organizations, events, archivedEvents, participants, users, activityLog, currentRole, currentUser, selectedOrganizationId, setSelectedOrganizationId, selectedEventId, setSelectedEventId, updateParticipantStatus, updateParticipantBibNumber, updateParticipantDetails, analyzeParticipantImport, confirmParticipantImportMapping, runParticipantImport, getParticipantFieldMappings, addParticipantManually, createEvent, updateEvent, deleteEvent, addUser, updateUser, createOrganization, updateOrganization, updateOrganizationEventLimit, deleteOrganization, removeUser, triggerUserPasswordReset, changeRole, assignScannerEvents, sendParticipantQrEmail, sendEventQrEmails, getParticipantQrPreview, scanParticipantQr, deleteParticipant, exportEventCsv, exportEventLogsCsv, visibleEvents, canAccessEvent, canViewEvent, isLoading, connectionState, lastSyncAt, snapshotSource, pendingMutationCount, scannerMode, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
