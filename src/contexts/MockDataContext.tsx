import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Event, Participant, User, ActivityLog, Role, Organization, ParticipantFieldMapping, ParticipantFieldRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface MockDataContextType {
  organizations: Organization[];
  events: Event[];
  participants: Participant[];
  users: User[];
  activityLog: ActivityLog[];
  currentRole: Role;
  currentUser: User;
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  checkIn: (participantId: string) => void;
  undoCheckIn: (participantId: string) => void;
  collectPackage: (participantId: string) => void;
  addParticipant: (p: Omit<Participant, 'id' | 'qr_code' | 'status' | 'package_status' | 'email_status'>) => void;
  updateParticipant: (id: string, data: Partial<Participant>) => void;
  importParticipants: (data: { name: string; email: string }[], eventId: string) => number;
  analyzeParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportAnalysis>;
  confirmParticipantImportMapping: (eventId: string, payload: ParticipantImportMappingPayload) => Promise<ParticipantFieldMapping[]>;
  runParticipantImport: (eventId: string, csvContent: string) => Promise<ParticipantImportRunResult>;
  getParticipantFieldMappings: (eventId: string) => Promise<ParticipantFieldMapping[]>;
  addParticipantManually: (eventId: string, email: string, fieldValues: Record<string, string>) => Promise<MutationResult>;
  createEvent: (e: Omit<Event, 'id'>) => Promise<MutationResult>;
  addUser: (u: Omit<User, 'id'>) => Promise<{ ok: boolean; error?: string }>;
  createOrganization: (data: { name: string; event_limit: number; admin_user_id?: string }) => Promise<MutationResult>;
  updateOrganizationEventLimit: (organizationId: string, eventLimit: number) => Promise<MutationResult>;
  removeUser: (id: string) => Promise<MutationResult>;
  changeRole: (userId: string, role: Role) => Promise<MutationResult>;
  assignScannerEvents: (userId: string, eventIds: string[]) => Promise<MutationResult>;
  markEmailsSent: (eventId: string) => void;
  addLog: (action: string, participantName?: string) => void;
  getParticipantsByEvent: (eventId: string) => Participant[];
  visibleEvents: Event[];
  canAccessEvent: (eventId: string) => boolean;
  isUsingApi: boolean;
  isLoading: boolean;
}

const MockDataContext = createContext<MockDataContextType | null>(null);
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

interface ApiParticipant {
  id: number | string;
  event_id: string | null;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  email: string;
  bib_number: string | null;
  qr_code: string | null;
  custom_fields?: Record<string, string> | null;
  status: 'pending' | 'checked_in' | null;
  package_status: 'not_collected' | 'collected' | null;
  email_status: 'not_sent' | 'sent' | null;
  checked_in_at: string | null;
}

interface ParticipantImportAnalysis {
  headers: string[];
  sample_rows: Record<string, string>[];
  email_candidates: { column: string; matched_count: number }[];
  has_mapping: boolean;
  mappings: ParticipantFieldMapping[];
  missing_required_columns: string[];
  row_count: number;
}

interface ParticipantImportMappingFieldInput {
  source_column_name: string;
  alias: string;
  field_role: Exclude<ParticipantFieldRole, 'email'>;
  is_active: boolean;
}

interface ParticipantImportMappingPayload {
  csv_columns: string[];
  email_column: string;
  fields: ParticipantImportMappingFieldInput[];
}

interface ParticipantImportRunResult {
  created_count: number;
  duplicate_count: number;
  invalid_count: number;
  invalid_rows: number[];
  participants: Participant[];
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  organization_id?: string | null;
  organization_ids?: string[];
  assigned_events: string[];
}

interface BootstrapResponse {
  data: {
    organizations: Organization[];
    events: Event[];
    users: ApiUser[];
    participants: ApiParticipant[];
    activityLog: ActivityLog[];
  };
}

interface MutationResult {
  ok: boolean;
  error?: string;
}

interface ApiEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  organization_id: string;
}

interface ApiSuccessResponse {
  success?: boolean;
  message?: string;
}

function mapApiParticipantToUi(p: ApiParticipant, fallbackEventId: string): Participant {
  const eventId = p.event_id ?? fallbackEventId;

  return {
    id: `p-${p.id}`,
    event_id: eventId,
    name: (p.display_name ?? `${p.first_name} ${p.last_name}`.trim()).trim(),
    email: p.email,
    bib_number: p.bib_number ?? `BIB-${p.id}`,
    qr_code: p.qr_code ?? `API-QR-${p.id}`,
    status: p.status ?? 'pending',
    package_status: p.package_status ?? 'not_collected',
    email_status: p.email_status ?? 'not_sent',
    checked_in_at: p.checked_in_at ?? undefined,
    custom_fields: p.custom_fields ?? {},
  };
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Participant' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function MockDataProvider({ children }: { children: ReactNode }) {
  const { user: authUser, token, getAuthHeaders, clearSession } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-1');
  const [isUsingApi, setIsUsingApi] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const syncStoredAuthUser = useCallback((updater: (user: User) => User) => {
    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) return;
      const parsed = JSON.parse(raw) as User;
      sessionStorage.setItem('auth_user', JSON.stringify(updater(parsed)));
    } catch {
      // Ignore session sync failures.
    }
  }, []);

  useEffect(() => {
    const loadBootstrap = async () => {
      setIsLoading(true);

      if (!authUser || !token) {
        setOrganizations([]);
        setEvents([]);
        setParticipants([]);
        setUsers([]);
        setActivityLog([]);
        setSelectedEventId('');
        setIsUsingApi(false);
        setIsLoading(false);
        throw new Error('Missing API token');
      }

      const response = await fetch(`${API_BASE_URL}/bootstrap`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 401) {
        clearSession();
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        throw new Error(`API bootstrap failed: ${response.status}`);
      }

      const payload = (await response.json()) as BootstrapResponse;
      const data = payload?.data;
      if (!data) {
        throw new Error('API bootstrap returned empty payload');
      }

      const apiEvents = Array.isArray(data.events) ? data.events : [];
      const nextSelectedEvent = apiEvents.some(e => e.id === selectedEventId)
        ? selectedEventId
        : apiEvents[0]?.id ?? '';

      setOrganizations(Array.isArray(data.organizations) ? data.organizations : []);
      setEvents(apiEvents);
      const apiUsers = data.users.map(u => ({
        ...u,
        organization_id: u.organization_id ?? undefined,
        organization_ids: Array.isArray(u.organization_ids) ? u.organization_ids : [],
        assigned_events: Array.isArray(u.assigned_events) ? u.assigned_events : [],
      }));
      setUsers(apiUsers);
      setParticipants((data.participants ?? []).map(p => mapApiParticipantToUi(p, nextSelectedEvent)));
      setActivityLog(Array.isArray(data.activityLog) ? data.activityLog : []);
      setSelectedEventId(nextSelectedEvent);
      setIsUsingApi(true);
      setIsLoading(false);
    };

    void loadBootstrap().catch(() => {
      setIsUsingApi(false);
      setIsLoading(false);
    });
  }, [authUser, clearSession, getAuthHeaders, selectedEventId, token]);

  const currentUser = useMemo(() => {
    if (!authUser) {
      return {
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'scanner' as const,
        assigned_events: [],
      };
    }
    return users.find(u => u.id === authUser.id) || authUser;
  }, [users, authUser]);

  const currentRole = currentUser.role;

  const visibleEvents = useMemo(() => {
    if (currentRole === 'superadmin') return events;
    if (currentRole === 'admin') return events.filter(e => (currentUser.organization_ids ?? []).includes(e.organization_id));
    if (currentRole === 'editor') return events.filter(e => e.organization_id === currentUser.organization_id);
    return events.filter(e => currentUser.assigned_events.includes(e.id));
  }, [events, currentRole, currentUser]);

  const canAccessEvent = useCallback((eventId: string) => {
    if (currentRole === 'superadmin') return true;
    if (currentRole === 'admin') {
      const ev = events.find(e => e.id === eventId);
      return !!ev && (currentUser.organization_ids ?? []).includes(ev.organization_id);
    }
    if (currentRole === 'editor') {
      const ev = events.find(e => e.id === eventId);
      return !!ev && ev.organization_id === currentUser.organization_id;
    }
    return currentUser.assigned_events.includes(eventId);
  }, [currentRole, currentUser, events]);

  const addLog = useCallback((action: string, participantName?: string) => {
    setActivityLog(prev => [{
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      participant_name: participantName,
      user_name: currentUser.name,
    }, ...prev]);
  }, [currentUser]);

  const checkIn = useCallback((participantId: string) => {
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, status: 'checked_in' as const, checked_in_at: new Date().toISOString() } : p
    ));
    const p = participants.find(x => x.id === participantId);
    if (p) addLog('Check-in', p.name);
  }, [participants, addLog]);

  const undoCheckIn = useCallback((participantId: string) => {
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, status: 'pending' as const, checked_in_at: undefined } : p
    ));
    const p = participants.find(x => x.id === participantId);
    if (p) addLog('Cofnięto odprawę', p.name);
  }, [participants, addLog]);

  const collectPackage = useCallback((participantId: string) => {
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, package_status: 'collected' as const } : p
    ));
    const p = participants.find(x => x.id === participantId);
    if (p) addLog('Wydano pakiet', p.name);
  }, [participants, addLog]);

  const createParticipantInApi = useCallback(async (
    data: Omit<Participant, 'id' | 'qr_code' | 'status' | 'package_status' | 'email_status'>
  ): Promise<Participant | null> => {
    const { firstName, lastName } = splitFullName(data.name);
    const response = await fetch(`${API_BASE_URL}/participants`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        event_id: data.event_id,
        first_name: firstName,
        last_name: lastName,
        display_name: data.name,
        email: data.email,
        bib_number: data.bib_number,
        qr_code: `QR-${data.event_id}-${Date.now()}`,
        status: 'pending',
        package_status: 'not_collected',
        email_status: 'not_sent',
      }),
    });

    if (!response.ok) {
      throw new Error(`API participant create failed: ${response.status}`);
    }

    const payload = await response.json();
    const created = payload?.data as ApiParticipant | undefined;
    if (!created) return null;
    return mapApiParticipantToUi(created, data.event_id);
  }, [getAuthHeaders]);

  const analyzeParticipantImport = useCallback(async (eventId: string, csvContent: string): Promise<ParticipantImportAnalysis> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-imports/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ csv_content: csvContent }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error ?? `API participant import analyze failed: ${response.status}`);
    }

    return (payload?.data ?? {}) as ParticipantImportAnalysis;
  }, [getAuthHeaders]);

  const confirmParticipantImportMapping = useCallback(async (
    eventId: string,
    payload: ParticipantImportMappingPayload
  ): Promise<ParticipantFieldMapping[]> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-imports/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
    });

    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(responsePayload?.error ?? `API participant import mapping confirm failed: ${response.status}`);
    }

    return Array.isArray(responsePayload?.data) ? responsePayload.data : [];
  }, [getAuthHeaders]);

  const runParticipantImport = useCallback(async (eventId: string, csvContent: string): Promise<ParticipantImportRunResult> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-imports/run`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ csv_content: csvContent }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = Array.isArray(payload?.missing_columns) && payload.missing_columns.length > 0
        ? ` (${payload.missing_columns.join(', ')})`
        : '';
      throw new Error((payload?.error ?? `API participant import run failed: ${response.status}`) + details);
    }

    const data = payload?.data ?? {};
    const createdParticipants = Array.isArray(data.participants)
      ? data.participants.map((participant: ApiParticipant) => mapApiParticipantToUi(participant, eventId))
      : [];

    setParticipants(prev => [...prev, ...createdParticipants]);
    if (createdParticipants.length > 0) {
      addLog(`Import CSV (${createdParticipants.length} uczestnikow)`);
    }

    return {
      created_count: Number(data.created_count ?? 0),
      duplicate_count: Number(data.duplicate_count ?? 0),
      invalid_count: Number(data.invalid_count ?? 0),
      invalid_rows: Array.isArray(data.invalid_rows) ? data.invalid_rows.map((row: number) => Number(row)) : [],
      participants: createdParticipants,
    };
  }, [addLog, getAuthHeaders]);

  const getParticipantFieldMappings = useCallback(async (eventId: string): Promise<ParticipantFieldMapping[]> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participant-field-mappings`, {
      headers: getAuthHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error ?? `API participant field mappings fetch failed: ${response.status}`);
    }

    return Array.isArray(payload?.data?.mappings) ? payload.data.mappings : [];
  }, [getAuthHeaders]);

  const addParticipantManually = useCallback(async (
    eventId: string,
    email: string,
    fieldValues: Record<string, string>
  ): Promise<MutationResult> => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants/manual`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        email,
        field_values: fieldValues,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error ?? `API manual participant create failed: ${response.status}`,
      };
    }

    const created = payload?.data as ApiParticipant | undefined;
    if (created) {
      const mapped = mapApiParticipantToUi(created, eventId);
      setParticipants(prev => [...prev, mapped]);
      addLog('Dodano uczestnika', mapped.name);
    }

    return { ok: true };
  }, [addLog, getAuthHeaders]);

  const createUserInApi = useCallback(async (data: Omit<User, 'id'>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        organization_id: data.organization_id,
        assigned_events: data.assigned_events,
      }),
    });

    if (!response.ok) {
      let error = `API user create failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep the status-based error when the response body is not JSON.
      }

      throw new Error(error);
    }

    const payload = await response.json() as { data?: ApiUser };
    if (!payload.data) {
      throw new Error('API user create returned empty payload');
    }

    return {
      ...payload.data,
      password: '',
      organization_id: payload.data.organization_id ?? undefined,
      organization_ids: Array.isArray(payload.data.organization_ids) ? payload.data.organization_ids : [],
      assigned_events: Array.isArray(payload.data.assigned_events) ? payload.data.assigned_events : [],
    };
  }, [getAuthHeaders]);

  const createEventInApi = useCallback(async (data: Omit<Event, 'id'>): Promise<Event> => {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let error = `API event create failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep status-based error.
      }

      throw new Error(error);
    }

    const payload = await response.json() as { data?: ApiEvent };
    if (!payload.data) {
      throw new Error('API event create returned empty payload');
    }

    return payload.data;
  }, [getAuthHeaders]);

  const updateOrganizationEventLimitInApi = useCallback(async (organizationId: string, eventLimit: number): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/event-limit`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ event_limit: eventLimit }),
    });

    if (!response.ok) {
      let error = `API organization update failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep status-based error.
      }

      throw new Error(error);
    }

    const payload = await response.json() as { data?: Organization };
    if (!payload.data) {
      throw new Error('API organization update returned empty payload');
    }

    return payload.data;
  }, [getAuthHeaders]);

  const createOrganizationInApi = useCallback(async (data: { name: string; event_limit: number; admin_user_id?: string }): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/organizations`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let error = `API organization create failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep status-based error.
      }

      throw new Error(error);
    }

    const payload = await response.json() as { data?: Organization };
    if (!payload.data) {
      throw new Error('API organization create returned empty payload');
    }

    return payload.data;
  }, [getAuthHeaders]);

  const assignScannerEventsInApi = useCallback(async (userId: string, eventIds: string[]): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/event-assignments`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ assigned_events: eventIds }),
    });

    if (!response.ok) {
      let error = `API scanner assignment failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep status-based error.
      }

      throw new Error(error);
    }

    const payload = await response.json() as { data?: ApiUser };
    if (!payload.data) {
      throw new Error('API scanner assignment returned empty payload');
    }

    return {
      ...payload.data,
      password: '',
      organization_id: payload.data.organization_id ?? undefined,
      organization_ids: Array.isArray(payload.data.organization_ids) ? payload.data.organization_ids : [],
      assigned_events: Array.isArray(payload.data.assigned_events) ? payload.data.assigned_events : [],
    };
  }, [getAuthHeaders]);

  const deleteUserInApi = useCallback(async (userId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      let error = `API user delete failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep status-based error.
      }

      throw new Error(error);
    }
  }, [getAuthHeaders]);

  const changeUserRoleInApi = useCallback(async (userId: string, role: Role): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      let error = `API user role change failed: ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep status-based error.
      }

      throw new Error(error);
    }

    const payload = await response.json() as { data?: ApiUser } | ApiSuccessResponse;
    const userData = 'data' in payload ? payload.data : undefined;
    if (!userData) {
      throw new Error('API user role change returned empty payload');
    }

    return {
      ...userData,
      password: '',
      organization_id: userData.organization_id ?? undefined,
      organization_ids: Array.isArray(userData.organization_ids) ? userData.organization_ids : [],
      assigned_events: Array.isArray(userData.assigned_events) ? userData.assigned_events : [],
    };
  }, [getAuthHeaders]);

  const addParticipant = useCallback((data: Omit<Participant, 'id' | 'qr_code' | 'status' | 'package_status' | 'email_status'>) => {
    const fallbackParticipant: Participant = {
      ...data,
      id: `p-${Date.now()}`,
      qr_code: `QR-${data.event_id}-${Date.now()}`,
      status: 'pending',
      package_status: 'not_collected',
      email_status: 'not_sent',
    };

    if (!isUsingApi) {
      setParticipants(prev => [...prev, fallbackParticipant]);
      addLog('Dodano uczestnika', data.name);
      return;
    }

    void createParticipantInApi(data)
      .then(apiParticipant => {
        setParticipants(prev => [...prev, apiParticipant ?? fallbackParticipant]);
      })
      .catch(() => {
        setParticipants(prev => [...prev, fallbackParticipant]);
      });

    addLog('Dodano uczestnika', data.name);
  }, [addLog, createParticipantInApi, isUsingApi]);

  const updateParticipant = useCallback((id: string, data: Partial<Participant>) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const importParticipants = useCallback((data: { name: string; email: string }[], eventId: string) => {
    const existing = participants.filter(p => p.event_id === eventId);
    const existingEmails = new Set(existing.map(p => p.email));
    const valid = data.filter(d => d.email && !existingEmails.has(d.email));
    const maxBib = Math.max(0, ...existing.map(p => parseInt(p.bib_number, 10) || 0));
    const newParticipants: Participant[] = valid.map((d, i) => ({
      id: `p-${Date.now()}-${i}`,
      event_id: eventId,
      name: d.name,
      email: d.email,
      bib_number: String(maxBib + i + 1),
      qr_code: `QR-${eventId}-${maxBib + i + 1}`,
      status: 'pending',
      package_status: 'not_collected',
      email_status: 'not_sent',
    }));
    setParticipants(prev => [...prev, ...newParticipants]);
    addLog(`Import CSV (${newParticipants.length} uczestnikow)`);
    return newParticipants.length;
  }, [participants, addLog]);

  const createEvent = useCallback(async (e: Omit<Event, 'id'>): Promise<MutationResult> => {
    const organization = organizations.find(org => org.id === e.organization_id);
    const organizationEventCount = events.filter(event => event.organization_id === e.organization_id).length;

    if (organization && organizationEventCount >= organization.event_limit) {
      return { ok: false, error: 'Limit wydarzen dla tej organizacji zostal osiagniety' };
    }

    if (!isUsingApi) {
      return { ok: false, error: 'API jest niedostepne. Wydarzenie nie zostalo zapisane w bazie danych.' };
    }

    try {
      const createdEvent = await createEventInApi(e);
      setEvents(prev => [...prev, createdEvent]);
      addLog(`Utworzono wydarzenie: ${createdEvent.name}`);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udalo sie utworzyc wydarzenia',
      };
    }
  }, [addLog, createEventInApi, events, isUsingApi, organizations]);

  const addUser = useCallback(async (u: Omit<User, 'id'>): Promise<MutationResult> => {
    if (!isUsingApi) {
      return { ok: false, error: 'API jest niedostepne. Uzytkownik nie zostal zapisany w bazie danych.' };
    }

    try {
      const createdUser = await createUserInApi(u);
      setUsers(prev => [...prev, createdUser]);
      addLog(`Dodano uzytkownika: ${createdUser.name}`);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udało się utworzyć użytkownika',
      };
    }
  }, [addLog, createUserInApi, isUsingApi]);

  const createOrganization = useCallback(async (data: { name: string; event_limit: number; admin_user_id?: string }): Promise<MutationResult> => {
    if (!isUsingApi) {
      return { ok: false, error: 'API jest niedostepne. Organizacja nie zostala zapisana w bazie danych.' };
    }

    try {
      const createdOrganization = await createOrganizationInApi(data);
      setOrganizations(prev => [...prev, createdOrganization]);
      if (currentRole === 'admin') {
        setUsers(prev => prev.map(user => user.id === currentUser.id ? {
          ...user,
          organization_ids: [...new Set([...(user.organization_ids ?? []), createdOrganization.id])],
        } : user));
        syncStoredAuthUser(user => ({
          ...user,
          organization_ids: [...new Set([...(user.organization_ids ?? []), createdOrganization.id])],
        }));
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udalo sie utworzyc organizacji',
      };
    }
  }, [createOrganizationInApi, currentRole, currentUser.id, isUsingApi, syncStoredAuthUser]);

  const assignScannerEvents = useCallback(async (userId: string, eventIds: string[]): Promise<MutationResult> => {
    if (!isUsingApi) {
      return { ok: false, error: 'API jest niedostepne. Przypisania skanera nie zostaly zapisane w bazie danych.' };
    }

    try {
      const updatedUser = await assignScannerEventsInApi(userId, eventIds);
      setUsers(prev => prev.map(user => user.id === userId ? updatedUser : user));
      syncStoredAuthUser(user => user.id === userId ? updatedUser : user);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udalo sie zapisac przypisan skanera',
      };
    }
  }, [assignScannerEventsInApi, isUsingApi, syncStoredAuthUser]);

  const updateOrganizationEventLimit = useCallback(async (organizationId: string, eventLimit: number): Promise<MutationResult> => {
    if (!isUsingApi) {
      setOrganizations(prev => prev.map(org => org.id === organizationId ? { ...org, event_limit: eventLimit } : org));
      return { ok: true };
    }

    try {
      const updatedOrganization = await updateOrganizationEventLimitInApi(organizationId, eventLimit);
      setOrganizations(prev => prev.map(org => org.id === organizationId ? updatedOrganization : org));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udalo sie zaktualizowac limitu wydarzen',
      };
    }
  }, [isUsingApi, updateOrganizationEventLimitInApi]);

  const removeUser = useCallback(async (id: string): Promise<MutationResult> => {
    if (!isUsingApi) {
      return { ok: false, error: 'API jest niedostepne. Uzytkownik nie zostal usuniety z bazy danych.' };
    }

    const existingUser = users.find(x => x.id === id);

    try {
      await deleteUserInApi(id);
      setUsers(prev => prev.filter(x => x.id !== id));
      if (existingUser) {
        addLog(`Usunieto uzytkownika: ${existingUser.name}`);
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udalo sie usunac uzytkownika',
      };
    }
  }, [addLog, deleteUserInApi, isUsingApi, users]);

  const changeRole = useCallback(async (userId: string, role: Role): Promise<MutationResult> => {
    if (!isUsingApi) {
      return { ok: false, error: 'API jest niedostepne. Rola nie zostala zapisana w bazie danych.' };
    }

    try {
      const updatedUser = await changeUserRoleInApi(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      syncStoredAuthUser(user => user.id === userId ? updatedUser : user);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nie udalo sie zmienic roli uzytkownika',
      };
    }
  }, [changeUserRoleInApi, isUsingApi, syncStoredAuthUser]);

  const markEmailsSent = useCallback((eventId: string) => {
    setParticipants(prev => prev.map(p =>
      p.event_id === eventId ? { ...p, email_status: 'sent' as const } : p
    ));
    addLog('Wyslano kody QR do wszystkich');
  }, [addLog]);

  const getParticipantsByEvent = useCallback((eventId: string) => {
    return participants.filter(p => p.event_id === eventId);
  }, [participants]);

  return (
    <MockDataContext.Provider value={{
      organizations,
      events,
      participants,
      users,
      activityLog,
      currentRole,
      currentUser,
      selectedEventId,
      setSelectedEventId,
      checkIn,
      undoCheckIn,
      collectPackage,
      addParticipant,
      updateParticipant,
      importParticipants,
      analyzeParticipantImport,
      confirmParticipantImportMapping,
      runParticipantImport,
      getParticipantFieldMappings,
      addParticipantManually,
      createEvent,
      addUser,
      createOrganization,
      updateOrganizationEventLimit,
      removeUser,
      changeRole,
      assignScannerEvents,
      markEmailsSent,
      addLog,
      getParticipantsByEvent,
      visibleEvents,
      canAccessEvent,
      isUsingApi,
      isLoading,
    }}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData() {
  const ctx = useContext(MockDataContext);
  if (!ctx) throw new Error('useMockData must be used within MockDataProvider');
  return ctx;
}
