import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityLog, Event, Organization, Participant, ParticipantFieldMapping, ParticipantFieldRole, ParticipantQrPreview, ParticipantScanResult, ParticipantStatus, Role, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { isEventOfficeOpen } from '@/lib/events';
import { normalizeParticipantStatus } from '@/lib/participant-status';

type UserCreateInput = Omit<User, 'id' | 'password'>;
interface MutationResult { ok: boolean; error?: string; entityId?: string; }
interface EventQrEmailResult { ok: boolean; sent_count: number; error_count: number; errors: Array<{ participant_id: number; participant_name: string; error: string }>; error?: string; }
interface ParticipantImportAnalysis { headers: string[]; sample_rows: Record<string, string>[]; email_candidates: { column: string; matched_count: number }[]; has_mapping: boolean; mappings: ParticipantFieldMapping[]; missing_required_columns: string[]; row_count: number; }
interface ParticipantImportMappingFieldInput { source_column_name: string; alias: string; field_role: Exclude<ParticipantFieldRole, 'email'>; is_active: boolean; }
interface ParticipantImportMappingPayload { csv_columns: string[]; email_column: string; fields: ParticipantImportMappingFieldInput[]; }
interface ParticipantImportRunResult { created_count: number; duplicate_count: number; invalid_count: number; invalid_rows: number[]; participants: Participant[]; }
interface ParticipantUpdatePayload { status?: ParticipantStatus; email?: string; field_values?: Record<string, string>; }
type EventMutationInput = Omit<Event, 'id'>;
interface OrganizationUpdateInput { name?: string; event_limit?: number; }
interface DataContextType {
  organizations: Organization[]; events: Event[]; participants: Participant[]; users: User[]; activityLog: ActivityLog[]; currentRole: Role; currentUser: User; selectedEventId: string; setSelectedEventId: (id: string) => void;
  updateParticipantStatus: (participantId: string, status: ParticipantStatus) => Promise<MutationResult>; reassignParticipantPackage: (participantId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  analyzeParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportAnalysis>; confirmParticipantImportMapping: (eventId: string, payload: ParticipantImportMappingPayload) => Promise<ParticipantFieldMapping[]>; runParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportRunResult>; getParticipantFieldMappings: (eventId: string) => Promise<ParticipantFieldMapping[]>; addParticipantManually: (eventId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  createEvent: (e: EventMutationInput) => Promise<MutationResult>; updateEvent: (eventId: string, data: EventMutationInput) => Promise<MutationResult>; deleteEvent: (eventId: string) => Promise<MutationResult>; addUser: (u: UserCreateInput) => Promise<MutationResult>; createOrganization: (data: { name: string; event_limit: number; admin_user_id?: string }) => Promise<MutationResult>; updateOrganization: (organizationId: string, data: OrganizationUpdateInput) => Promise<MutationResult>; updateOrganizationEventLimit: (organizationId: string, eventLimit: number) => Promise<MutationResult>; deleteOrganization: (organizationId: string) => Promise<MutationResult>; removeUser: (id: string) => Promise<MutationResult>; changeRole: (userId: string, role: Role) => Promise<MutationResult>; assignScannerEvents: (userId: string, eventIds: string[]) => Promise<MutationResult>;
  sendParticipantQrEmail: (participantId: string) => Promise<MutationResult>; sendEventQrEmails: (eventId: string, resendAll?: boolean) => Promise<EventQrEmailResult>; getParticipantQrPreview: (participantId: string) => Promise<ParticipantQrPreview>; scanParticipantQr: (qrCode: string, autoCheckIn?: boolean) => Promise<{ ok: boolean; data?: ParticipantScanResult; error?: string; status?: number }>;
  deleteParticipant: (participantId: string) => Promise<MutationResult>;
  exportEventCsv: (eventId: string) => Promise<MutationResult>;
  exportEventLogsCsv: (eventId: string) => Promise<MutationResult>;
  visibleEvents: Event[]; canAccessEvent: (eventId: string) => boolean; isLoading: boolean;
}
const DataContext = createContext<DataContextType | null>(null);
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const SELECTED_EVENT_STORAGE_KEY_PREFIX = 'selected_event_context';
interface ApiParticipant { id: number | string; event_id: string | null; first_name: string; last_name: string; display_name?: string | null; email: string; bib_number: string | null; qr_code: string | null; custom_fields?: Record<string, string> | null; status: ParticipantStatus | 'pending' | null; email_status: 'not_sent' | 'sent' | null; checked_in_at: string | null; }
interface ApiUser { id: string; name: string; email: string; password?: string; role: Role; organization_id?: string | null; organization_ids?: string[]; assigned_events: string[]; }
type ApiEvent = Event;
interface BootstrapResponse { data: { organizations: Organization[]; events: ApiEvent[]; users: ApiUser[]; participants: ApiParticipant[]; activityLog: ActivityLog[]; }; }
interface ParticipantQrPreviewResponse { data?: { participant?: ApiParticipant; event?: ApiEvent; qr_code_svg_data_uri?: string; qr_code_image_url?: string; }; error?: string; }
interface ParticipantScanApiResponse { data?: { participant?: ApiParticipant; event?: ApiEvent; access?: { allowed?: boolean; }; }; error?: string; }
function getSelectedEventStorageKey(userId: string) { return `${SELECTED_EVENT_STORAGE_KEY_PREFIX}:${userId}`; }
function readStoredSelectedEventId(userId?: string | null): string {
  if (!userId) return '';
  try {
    return localStorage.getItem(getSelectedEventStorageKey(userId)) ?? '';
  } catch {
    return '';
  }
}
function mapApiParticipantToUi(participant: ApiParticipant, fallbackEventId: string): Participant { const eventId = participant.event_id ?? fallbackEventId; return { id: `p-${participant.id}`, event_id: eventId, name: (participant.display_name ?? `${participant.first_name} ${participant.last_name}`.trim()).trim(), email: participant.email, bib_number: participant.bib_number ?? `BIB-${participant.id}`, qr_code: participant.qr_code ?? '', status: normalizeParticipantStatus(participant.status), email_status: participant.email_status ?? 'not_sent', checked_in_at: participant.checked_in_at ?? undefined, custom_fields: participant.custom_fields ?? {} }; }
function participantUiIdToApiId(participantId: string): string { return participantId.startsWith('p-') ? participantId.slice(2) : participantId; }
function mapApiUserToUi(user: ApiUser): User { return { ...user, password: '', organization_id: user.organization_id ?? undefined, organization_ids: Array.isArray(user.organization_ids) ? user.organization_ids : [], assigned_events: Array.isArray(user.assigned_events) ? user.assigned_events : [] }; }
function getDefaultCurrentUser(): User { return { id: '', name: '', email: '', password: '', role: 'scanner', assigned_events: [] }; }
function getVisibleEventsForUser(allEvents: Event[], user: User, now = new Date()): Event[] {
  if (user.role === 'superadmin') return allEvents;
  if (user.role === 'admin') return allEvents.filter(event => (user.organization_ids ?? []).includes(event.organization_id));
  if (user.role === 'editor') return allEvents.filter(event => event.organization_id === user.organization_id);
  return allEvents.filter(event => user.assigned_events.includes(event.id) && isEventOfficeOpen(event, now));
}
function resolveSelectedEventId(availableEvents: Event[], preferredSelectedEventId: string): string {
  return availableEvents.some(event => event.id === preferredSelectedEventId) ? preferredSelectedEventId : availableEvents[0]?.id ?? '';
}
export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser, token, getAuthHeaders, clearSession } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]); const [events, setEvents] = useState<Event[]>([]); const [participants, setParticipants] = useState<Participant[]>([]); const [users, setUsers] = useState<User[]>([]); const [activityLog, setActivityLog] = useState<ActivityLog[]>([]); const [selectedEventId, setSelectedEventIdState] = useState<string>(''); const [isLoading, setIsLoading] = useState(true); const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const resetState = useCallback(() => { setOrganizations([]); setEvents([]); setParticipants([]); setUsers([]); setActivityLog([]); setSelectedEventIdState(''); }, []);
  const persistSelectedEventId = useCallback((eventId: string, userId?: string | null) => { if (!userId) return; try { const key = getSelectedEventStorageKey(userId); if (eventId) { localStorage.setItem(key, eventId); return; } localStorage.removeItem(key); } catch {} }, []);
  const setSelectedEventId = useCallback((eventId: string) => { setSelectedEventIdState(eventId); persistSelectedEventId(eventId, authUser?.id); }, [authUser?.id, persistSelectedEventId]);
  const syncStoredAuthUser = useCallback((updater: (user: User) => User) => { try { const raw = sessionStorage.getItem('auth_user'); if (!raw) return; const parsed = JSON.parse(raw) as User; sessionStorage.setItem('auth_user', JSON.stringify(updater(parsed))); } catch {} }, []);
  const loadBootstrap = useCallback(async () => {
    setIsLoading(true);
    if (!authUser || !token) { resetState(); setIsLoading(false); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/bootstrap`, { headers: getAuthHeaders() }); if (response.status === 401) { clearSession(); throw new Error('Unauthorized'); } if (!response.ok) throw new Error(`API bootstrap failed: ${response.status}`);
      const payload = (await response.json()) as BootstrapResponse; const data = payload?.data; if (!data) throw new Error('API bootstrap returned empty payload'); const apiEvents = Array.isArray(data.events) ? data.events : []; const nextUsers = (data.users ?? []).map(mapApiUserToUi); const nextCurrentUser = nextUsers.find(user => user.id === authUser.id) ?? authUser; const availableEvents = getVisibleEventsForUser(apiEvents, nextCurrentUser); const storedSelectedEventId = readStoredSelectedEventId(authUser.id); const nextSelectedEvent = resolveSelectedEventId(availableEvents, storedSelectedEventId);
      setOrganizations(Array.isArray(data.organizations) ? data.organizations : []); setEvents(apiEvents); setUsers(nextUsers); setParticipants((data.participants ?? []).map(participant => mapApiParticipantToUi(participant, nextSelectedEvent))); setActivityLog(Array.isArray(data.activityLog) ? data.activityLog : []); setSelectedEventIdState(nextSelectedEvent); persistSelectedEventId(nextSelectedEvent, authUser.id);
    } catch (error) {
      resetState();
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [authUser, clearSession, getAuthHeaders, persistSelectedEventId, resetState, token]);
  useEffect(() => { void loadBootstrap().catch(() => undefined); }, [loadBootstrap]);
  useEffect(() => { if (!authUser?.id) { setSelectedEventIdState(''); return; } setSelectedEventIdState(readStoredSelectedEventId(authUser.id)); }, [authUser?.id]);
  useEffect(() => {
    if (!authUser?.id) return undefined;
    const storageKey = getSelectedEventStorageKey(authUser.id);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setSelectedEventIdState(event.newValue ?? '');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [authUser?.id]);
  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);
  const currentUser = useMemo(() => { if (!authUser) return getDefaultCurrentUser(); return users.find(user => user.id === authUser.id) || authUser; }, [users, authUser]);
  const currentRole = currentUser.role;
  const visibleEvents = useMemo(() => getVisibleEventsForUser(events, currentUser, new Date(nowTimestamp)), [currentUser, events, nowTimestamp]);
  useEffect(() => {
    const nextVisibleEventId = visibleEvents[0]?.id ?? '';
    if (visibleEvents.some(event => event.id === selectedEventId) || nextVisibleEventId === selectedEventId) {
      return;
    }

    setSelectedEventId(nextVisibleEventId);
  }, [selectedEventId, setSelectedEventId, visibleEvents]);
  const canAccessEvent = useCallback((eventId: string) => { if (currentRole === 'superadmin') return true; const event = events.find(entry => entry.id === eventId); if (!event) return false; if (currentRole === 'admin') return (currentUser.organization_ids ?? []).includes(event.organization_id); if (currentRole === 'editor') return event.organization_id === currentUser.organization_id; return currentUser.assigned_events.includes(eventId) && isEventOfficeOpen(event, new Date(nowTimestamp)); }, [currentRole, currentUser, events, nowTimestamp]);
  const addLog = useCallback((action: string, participantName?: string) => { setActivityLog(previous => [{ id: `log-${Date.now()}`, timestamp: new Date().toISOString(), action, participant_name: participantName, user_name: currentUser.name }, ...previous]); }, [currentUser.name]);
  const replaceParticipant = useCallback((participant: Participant) => { setParticipants(previous => previous.map(existing => existing.id === participant.id ? participant : existing)); }, []);
  const updateParticipantInApi = useCallback(async (participantId: string, data: ParticipantUpdatePayload): Promise<Participant | null> => {
    const response = await fetch(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) });
    const payload = await response.json().catch(() => ({})) as { data?: ApiParticipant; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error ?? `API participant update failed: ${response.status}`);
    return mapApiParticipantToUi(payload.data, selectedEventId);
  }, [getAuthHeaders, selectedEventId]);
  const updateParticipantStatus = useCallback(async (participantId: string, status: ParticipantStatus): Promise<MutationResult> => {
    try {
      const participant = await updateParticipantInApi(participantId, { status });
      if (participant) replaceParticipant(participant);
      await loadBootstrap().catch(() => undefined);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zaktualizować statusu uczestnika' };
    }
  }, [loadBootstrap, replaceParticipant, updateParticipantInApi]);
  const reassignParticipantPackage = useCallback(async (participantId: string, email: string, fieldValues: Record<string, string>): Promise<MutationResult> => {
    try {
      const participant = await updateParticipantInApi(participantId, { email, field_values: fieldValues });
      if (participant) replaceParticipant(participant);
      await loadBootstrap().catch(() => undefined);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się przepisać pakietu' };
    }
  }, [loadBootstrap, replaceParticipant, updateParticipantInApi]);
  const analyzeParticipantImport = useCallback(async (eventId: string, csvContent: string): Promise<ParticipantImportAnalysis> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-imports/analyze`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ csv_content: csvContent }) });
    const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error ?? `API participant import analyze failed: ${response.status}`); return (payload?.data ?? {}) as ParticipantImportAnalysis;
  }, [getAuthHeaders]);
  const confirmParticipantImportMapping = useCallback(async (eventId: string, payload: ParticipantImportMappingPayload): Promise<ParticipantFieldMapping[]> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-imports/confirm`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(payload) });
    const responsePayload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(responsePayload?.error ?? `API participant import mapping confirm failed: ${response.status}`); return Array.isArray(responsePayload?.data) ? responsePayload.data : [];
  }, [getAuthHeaders]);
  const runParticipantImport = useCallback(async (eventId: string, csvContent: string): Promise<ParticipantImportRunResult> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-imports/run`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ csv_content: csvContent }) });
    const payload = await response.json().catch(() => ({})); if (!response.ok) { const details = Array.isArray(payload?.missing_columns) && payload.missing_columns.length > 0 ? ` (${payload.missing_columns.join(', ')})` : ''; throw new Error((payload?.error ?? `API participant import run failed: ${response.status}`) + details); }
    const data = payload?.data ?? {}; const createdParticipants = Array.isArray(data.participants) ? data.participants.map((participant: ApiParticipant) => mapApiParticipantToUi(participant, eventId)) : []; setParticipants(previous => [...previous, ...createdParticipants]); if (createdParticipants.length > 0) addLog(`Import CSV (${createdParticipants.length} uczestników)`);
    return { created_count: Number(data.created_count ?? 0), duplicate_count: Number(data.duplicate_count ?? 0), invalid_count: Number(data.invalid_count ?? 0), invalid_rows: Array.isArray(data.invalid_rows) ? data.invalid_rows.map((row: number) => Number(row)) : [], participants: createdParticipants };
  }, [addLog, getAuthHeaders]);
  const getParticipantFieldMappings = useCallback(async (eventId: string): Promise<ParticipantFieldMapping[]> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-field-mappings`, { headers: getAuthHeaders() }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error ?? `API participant field mappings fetch failed: ${response.status}`); return Array.isArray(payload?.data?.mappings) ? payload.data.mappings : [];
  }, [getAuthHeaders]);
  const addParticipantManually = useCallback(async (eventId: string, email: string, fieldValues: Record<string, string>): Promise<MutationResult> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants/manual`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ email, field_values: fieldValues }) });
    const payload = await response.json().catch(() => ({})); if (!response.ok) return { ok: false, error: payload?.error ?? `API manual participant create failed: ${response.status}` };
    const created = payload?.data as ApiParticipant | undefined; if (created) { const mapped = mapApiParticipantToUi(created, eventId); setParticipants(previous => [...previous, mapped]); addLog('Dodano uczestnika', mapped.name); }
    return { ok: true };
  }, [addLog, getAuthHeaders]);
  const createUserInApi = useCallback(async (data: UserCreateInput): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ name: data.name, email: data.email, role: data.role, organization_id: data.organization_id, assigned_events: data.assigned_events }) });
    if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API user create failed: ${response.status}`); }
    const payload = await response.json() as { data?: ApiUser }; if (!payload.data) throw new Error('API user create returned empty payload'); return mapApiUserToUi(payload.data);
  }, [getAuthHeaders]);
  const createEventInApi = useCallback(async (data: EventMutationInput): Promise<Event> => {
    const response = await fetch(`${API_BASE_URL}/events`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(data) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API event create failed: ${response.status}`); }
    const payload = await response.json() as { data?: ApiEvent }; if (!payload.data) throw new Error('API event create returned empty payload'); return payload.data;
  }, [getAuthHeaders]);
  const updateEventInApi = useCallback(async (eventId: string, data: EventMutationInput): Promise<Event> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error ?? `API event update failed: ${response.status}`);
    }
    const payload = await response.json() as { data?: ApiEvent };
    if (!payload.data) throw new Error('API event update returned empty payload');
    return payload.data;
  }, [getAuthHeaders]);
  const deleteEventInApi = useCallback(async (eventId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API event delete failed: ${response.status}`); }
  }, [getAuthHeaders]);
  const updateOrganizationEventLimitInApi = useCallback(async (organizationId: string, eventLimit: number): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/event-limit`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ event_limit: eventLimit }) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API organization update failed: ${response.status}`); }
    const payload = await response.json() as { data?: Organization }; if (!payload.data) throw new Error('API organization update returned empty payload'); return payload.data;
  }, [getAuthHeaders]);
  const createOrganizationInApi = useCallback(async (data: { name: string; event_limit: number; admin_user_id?: string }): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/organizations`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify(data) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API organization create failed: ${response.status}`); }
    const payload = await response.json() as { data?: Organization }; if (!payload.data) throw new Error('API organization create returned empty payload'); return payload.data;
  }, [getAuthHeaders]);
  const updateOrganizationInApi = useCallback(async (organizationId: string, data: OrganizationUpdateInput): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify(data) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API organization update failed: ${response.status}`); }
    const payload = await response.json() as { data?: Organization }; if (!payload.data) throw new Error('API organization update returned empty payload'); return payload.data;
  }, [getAuthHeaders]);
  const deleteOrganizationInApi = useCallback(async (organizationId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}`, { method: 'DELETE', headers: getAuthHeaders() }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API organization delete failed: ${response.status}`); }
  }, [getAuthHeaders]);
  const assignScannerEventsInApi = useCallback(async (userId: string, eventIds: string[]): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/event-assignments`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify({ assigned_events: eventIds }) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API scanner assignment failed: ${response.status}`); }
    const payload = await response.json() as { data?: ApiUser }; if (!payload.data) throw new Error('API scanner assignment returned empty payload'); return mapApiUserToUi(payload.data);
  }, [getAuthHeaders]);
  const deleteUserInApi = useCallback(async (userId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE', headers: getAuthHeaders() }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API user delete failed: ${response.status}`); }
  }, [getAuthHeaders]);
  const changeUserRoleInApi = useCallback(async (userId: string, role: Role): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, { method: 'PATCH', headers: getAuthHeaders(true), body: JSON.stringify({ role }) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API user role change failed: ${response.status}`); }
    const payload = await response.json() as { data?: ApiUser }; if (!payload.data) throw new Error('API user role change returned empty payload'); return mapApiUserToUi(payload.data);
  }, [getAuthHeaders]);
  const deleteParticipantInApi = useCallback(async (participantId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}`, { method: 'DELETE', headers: getAuthHeaders() }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API participant delete failed: ${response.status}`); }
  }, [getAuthHeaders]);
  const createEvent = useCallback(async (eventData: EventMutationInput): Promise<MutationResult> => {
    const organization = organizations.find(entry => entry.id === eventData.organization_id); const organizationEventCount = events.filter(event => event.organization_id === eventData.organization_id).length;
    if (organization && organizationEventCount >= organization.event_limit) return { ok: false, error: 'Limit wydarzeń dla tej organizacji został osiągnięty' };
    try { const createdEvent = await createEventInApi(eventData); setEvents(previous => [...previous, createdEvent]); addLog(`Utworzono wydarzenie: ${createdEvent.name}`); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się utworzyć wydarzenia' }; }
  }, [addLog, createEventInApi, events, organizations]);
  const updateEvent = useCallback(async (eventId: string, eventData: EventMutationInput): Promise<MutationResult> => {
    try {
      const updatedEvent = await updateEventInApi(eventId, eventData);
      setEvents(previous => previous.map(event => event.id === eventId ? updatedEvent : event));
      addLog(`Zaktualizowano wydarzenie: ${updatedEvent.name}`);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zaktualizować wydarzenia' };
    }
  }, [addLog, updateEventInApi]);
  const deleteEvent = useCallback(async (eventId: string): Promise<MutationResult> => {
    const existingEvent = events.find(event => event.id === eventId);
    try {
      await deleteEventInApi(eventId);
      setEvents(previous => previous.filter(event => event.id !== eventId));
      setParticipants(previous => previous.filter(participant => participant.event_id !== eventId));
      setUsers(previous => previous.map(user => ({ ...user, assigned_events: user.assigned_events.filter(assignedEventId => assignedEventId !== eventId) })));
      if (selectedEventId === eventId) {
        setSelectedEventId('');
      }
      if (existingEvent) addLog(`Usunięto wydarzenie: ${existingEvent.name}`);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się usunąć wydarzenia' };
    }
  }, [addLog, deleteEventInApi, events, selectedEventId, setSelectedEventId]);
  const addUser = useCallback(async (userData: UserCreateInput): Promise<MutationResult> => {
    try { const createdUser = await createUserInApi(userData); setUsers(previous => [...previous, createdUser]); addLog(`Dodano użytkownika: ${createdUser.name}`); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się utworzyć użytkownika' }; }
  }, [addLog, createUserInApi]);
  const createOrganization = useCallback(async (data: { name: string; event_limit: number; admin_user_id?: string }): Promise<MutationResult> => {
    try { const createdOrganization = await createOrganizationInApi(data); setOrganizations(previous => [...previous, createdOrganization]); if (currentRole === 'admin') { setUsers(previous => previous.map(user => user.id === currentUser.id ? { ...user, organization_ids: [...new Set([...(user.organization_ids ?? []), createdOrganization.id])] } : user)); syncStoredAuthUser(user => ({ ...user, organization_ids: [...new Set([...(user.organization_ids ?? []), createdOrganization.id])] })); } return { ok: true, entityId: createdOrganization.id }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się utworzyć organizacji' }; }
  }, [createOrganizationInApi, currentRole, currentUser.id, syncStoredAuthUser]);
  const updateOrganization = useCallback(async (organizationId: string, data: OrganizationUpdateInput): Promise<MutationResult> => {
    try { const updatedOrganization = await updateOrganizationInApi(organizationId, data); setOrganizations(previous => previous.map(organization => organization.id === organizationId ? updatedOrganization : organization)); if (data.name) addLog(`Zaktualizowano organizację: ${updatedOrganization.name}`); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zaktualizować organizacji' }; }
  }, [addLog, updateOrganizationInApi]);
  const assignScannerEvents = useCallback(async (userId: string, eventIds: string[]): Promise<MutationResult> => {
    try { const updatedUser = await assignScannerEventsInApi(userId, eventIds); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zapisać przypisań skanera' }; }
  }, [assignScannerEventsInApi, syncStoredAuthUser]);
  const updateOrganizationEventLimit = useCallback(async (organizationId: string, eventLimit: number): Promise<MutationResult> => {
    const assignedEventsCount = events.filter(event => event.organization_id === organizationId).length;
    if (eventLimit < assignedEventsCount) {
      return {
        ok: false,
        error: `Limit wydarzeń nie może być mniejszy niż ${assignedEventsCount}, bo tyle wydarzeń jest już przypisanych do tej organizacji.`,
      };
    }

    try { const updatedOrganization = await updateOrganizationEventLimitInApi(organizationId, eventLimit); setOrganizations(previous => previous.map(organization => organization.id === organizationId ? updatedOrganization : organization)); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zaktualizować limitu wydarzeń' }; }
  }, [events, updateOrganizationEventLimitInApi]);
  const deleteOrganization = useCallback(async (organizationId: string): Promise<MutationResult> => {
    const existingOrganization = organizations.find(organization => organization.id === organizationId);
    try { await deleteOrganizationInApi(organizationId); setOrganizations(previous => previous.filter(organization => organization.id !== organizationId)); setUsers(previous => previous.map(user => user.id === currentUser.id ? { ...user, organization_ids: (user.organization_ids ?? []).filter(id => id !== organizationId) } : user)); if (currentUser.id) { syncStoredAuthUser(user => user.id === currentUser.id ? { ...user, organization_ids: (user.organization_ids ?? []).filter(id => id !== organizationId) } : user); } if (existingOrganization) addLog(`Usunięto organizację: ${existingOrganization.name}`); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się usunąć organizacji' }; }
  }, [addLog, currentUser.id, deleteOrganizationInApi, organizations, syncStoredAuthUser]);
  const removeUser = useCallback(async (id: string): Promise<MutationResult> => {
    const existingUser = users.find(user => user.id === id);
    try { await deleteUserInApi(id); setUsers(previous => previous.filter(user => user.id !== id)); if (existingUser) addLog(`Usunięto użytkownika: ${existingUser.name}`); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się usunąć użytkownika' }; }
  }, [addLog, deleteUserInApi, users]);
  const changeRole = useCallback(async (userId: string, role: Role): Promise<MutationResult> => {
    try { const updatedUser = await changeUserRoleInApi(userId, role); setUsers(previous => previous.map(user => user.id === userId ? updatedUser : user)); syncStoredAuthUser(user => user.id === userId ? updatedUser : user); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się zmienić roli użytkownika' }; }
  }, [changeUserRoleInApi, syncStoredAuthUser]);
  const sendParticipantQrEmail = useCallback(async (participantId: string): Promise<MutationResult> => {
    const response = await fetch(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}/send-qr-email`, { method: 'POST', headers: getAuthHeaders() });
    const payload = await response.json().catch(() => ({})) as { data?: ApiParticipant; error?: string };
    if (!response.ok || !payload.data) return { ok: false, error: payload.error ?? `API QR email send failed: ${response.status}` };
    replaceParticipant(mapApiParticipantToUi(payload.data, selectedEventId)); await loadBootstrap().catch(() => undefined); return { ok: true };
  }, [getAuthHeaders, loadBootstrap, replaceParticipant, selectedEventId]);
  const sendEventQrEmails = useCallback(async (eventId: string, resendAll = false): Promise<EventQrEmailResult> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/send-qr-emails`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ resend_all: resendAll }) });
    const payload = await response.json().catch(() => ({})) as { data?: { sent_count?: number; error_count?: number; errors?: Array<{ participant_id: number; participant_name: string; error: string }> }; error?: string; };
    if (!response.ok || !payload.data) return { ok: false, sent_count: 0, error_count: 0, errors: [], error: payload.error ?? `API event QR email send failed: ${response.status}` };
    await loadBootstrap().catch(() => undefined); return { ok: true, sent_count: Number(payload.data.sent_count ?? 0), error_count: Number(payload.data.error_count ?? 0), errors: Array.isArray(payload.data.errors) ? payload.data.errors : [] };
  }, [getAuthHeaders, loadBootstrap]);
  const getParticipantQrPreview = useCallback(async (participantId: string): Promise<ParticipantQrPreview> => {
    const response = await fetch(`${API_BASE_URL}/participants/${participantUiIdToApiId(participantId)}/qr-preview`, { headers: getAuthHeaders() });
    const payload = await response.json().catch(() => ({})) as ParticipantQrPreviewResponse;
    if (!response.ok || !payload.data?.participant || !payload.data.event) throw new Error(payload.error ?? `API QR preview failed: ${response.status}`);
    return { participant: mapApiParticipantToUi(payload.data.participant, payload.data.event.id), event: payload.data.event, qr_code_svg_data_uri: payload.data.qr_code_svg_data_uri ?? '', qr_code_image_url: payload.data.qr_code_image_url ?? '' };
  }, [getAuthHeaders]);
  const scanParticipantQr = useCallback(async (qrCode: string, autoCheckIn = false) => {
    const response = await fetch(`${API_BASE_URL}/participants/scan`, { method: 'POST', headers: getAuthHeaders(true), body: JSON.stringify({ qr_code: qrCode, auto_check_in: autoCheckIn }) });
    const payload = await response.json().catch(() => ({})) as ParticipantScanApiResponse;
    if (!response.ok || !payload.data?.participant || !payload.data.event) return { ok: false, error: payload.error ?? `API QR scan failed: ${response.status}`, status: response.status };
    await loadBootstrap().catch(() => undefined);
    return { ok: true, data: { participant: mapApiParticipantToUi(payload.data.participant, payload.data.event.id), event: payload.data.event, access: { allowed: Boolean(payload.data.access?.allowed) } }, status: response.status };
  }, [getAuthHeaders, loadBootstrap]);
  const deleteParticipant = useCallback(async (participantId: string): Promise<MutationResult> => {
    const existingParticipant = participants.find(participant => participant.id === participantId);
    try { await deleteParticipantInApi(participantId); setParticipants(previous => previous.filter(participant => participant.id !== participantId)); if (existingParticipant) addLog('Usunięto uczestnika', existingParticipant.name); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się usunąć uczestnika' }; }
  }, [addLog, deleteParticipantInApi, participants]);
  const exportEventCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        return { ok: false, error: payload.error ?? `API event export failed: ${response.status}` };
      }

      const blob = await response.blob();
      const fallbackName = `event-${eventId}-participants.csv`;
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? fallbackName;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować CSV' };
    }
  }, [getAuthHeaders]);
  const exportEventLogsCsv = useCallback(async (eventId: string): Promise<MutationResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/logs/export.csv`, { headers: getAuthHeaders() });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        return { ok: false, error: payload.error ?? `API event logs export failed: ${response.status}` };
      }

      const blob = await response.blob();
      const fallbackName = `event-${eventId}-logs.csv`;
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? fallbackName;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nie udało się wyeksportować logów CSV' };
    }
  }, [getAuthHeaders]);
  return (
    <DataContext.Provider value={{ organizations, events, participants, users, activityLog, currentRole, currentUser, selectedEventId, setSelectedEventId, updateParticipantStatus, reassignParticipantPackage, analyzeParticipantImport, confirmParticipantImportMapping, runParticipantImport, getParticipantFieldMappings, addParticipantManually, createEvent, updateEvent, deleteEvent, addUser, createOrganization, updateOrganization, updateOrganizationEventLimit, deleteOrganization, removeUser, changeRole, assignScannerEvents, sendParticipantQrEmail, sendEventQrEmails, getParticipantQrPreview, scanParticipantQr, deleteParticipant, exportEventCsv, exportEventLogsCsv, visibleEvents, canAccessEvent, isLoading }}>
      {children}
    </DataContext.Provider>
  );
}
export function useData() { const context = useContext(DataContext); if (!context) throw new Error('useData must be used within DataProvider'); return context; }
