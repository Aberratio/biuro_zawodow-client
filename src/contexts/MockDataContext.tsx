import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Event, Participant, User, ActivityLog, Role, Organization } from '@/types';
import { mockEvents, mockParticipants, mockUsers, mockActivityLog, mockOrganizations } from '@/data/mockData';
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
  createEvent: (e: Omit<Event, 'id'>) => void;
  addUser: (u: Omit<User, 'id'>) => void;
  removeUser: (id: string) => void;
  changeRole: (userId: string, role: Role) => void;
  markEmailsSent: (eventId: string) => void;
  addLog: (action: string, participantName?: string) => void;
  getParticipantsByEvent: (eventId: string) => Participant[];
  visibleEvents: Event[];
  canAccessEvent: (eventId: string) => boolean;
  isUsingApi: boolean;
  isLoading: boolean;
}

const MockDataContext = createContext<MockDataContextType | null>(null);
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8081').replace(/\/+$/, '');

interface ApiParticipant {
  id: number | string;
  event_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  bib_number: string | null;
  qr_code: string | null;
  status: 'pending' | 'checked_in' | null;
  package_status: 'not_collected' | 'collected' | null;
  email_status: 'not_sent' | 'sent' | null;
  checked_in_at: string | null;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  organization_id?: string | null;
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

function mapApiParticipantToUi(p: ApiParticipant, fallbackEventId: string): Participant {
  const eventId = p.event_id ?? fallbackEventId;

  return {
    id: `p-${p.id}`,
    event_id: eventId,
    name: `${p.first_name} ${p.last_name}`.trim(),
    email: p.email,
    bib_number: p.bib_number ?? `BIB-${p.id}`,
    qr_code: p.qr_code ?? `API-QR-${p.id}`,
    status: p.status ?? 'pending',
    package_status: p.package_status ?? 'not_collected',
    email_status: p.email_status ?? 'not_sent',
    checked_in_at: p.checked_in_at ?? undefined,
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
  const { user: authUser } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrganizations);
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [participants, setParticipants] = useState<Participant[]>(mockParticipants);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>(mockActivityLog);
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-1');
  const [isUsingApi, setIsUsingApi] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBootstrap = async () => {
      const response = await fetch(`${API_BASE_URL}/bootstrap`);
      if (!response.ok) {
        throw new Error(`API bootstrap failed: ${response.status}`);
      }

      const payload = (await response.json()) as BootstrapResponse;
      const data = payload?.data;
      if (!data) {
        throw new Error('API bootstrap returned empty payload');
      }

      const apiEvents = Array.isArray(data.events) && data.events.length > 0 ? data.events : mockEvents;
      const nextSelectedEvent = apiEvents.some(e => e.id === selectedEventId)
        ? selectedEventId
        : apiEvents[0]?.id ?? 'evt-1';

      setOrganizations(Array.isArray(data.organizations) && data.organizations.length > 0 ? data.organizations : mockOrganizations);
      setEvents(apiEvents);
      const apiUsers = data.users.map(u => ({
        ...u,
        organization_id: u.organization_id ?? undefined,
        assigned_events: Array.isArray(u.assigned_events) ? u.assigned_events : [],
      }));
      setUsers(apiUsers.length > 0 ? apiUsers : mockUsers);
      setParticipants((data.participants ?? []).map(p => mapApiParticipantToUi(p, nextSelectedEvent)));
      setActivityLog(Array.isArray(data.activityLog) ? data.activityLog : mockActivityLog);
      setSelectedEventId(nextSelectedEvent);
      setIsUsingApi(true);
      setIsLoading(false);
    };

    void loadBootstrap().catch(() => {
      setIsUsingApi(false);
      setIsLoading(false);
    });
  }, []);

  const currentUser = useMemo(() => {
    if (!authUser) return users[0];
    return users.find(u => u.id === authUser.id) || users[0];
  }, [users, authUser]);

  const currentRole = currentUser.role;

  const visibleEvents = useMemo(() => {
    if (currentRole === 'superadmin') return events;
    if (currentRole === 'admin') return events.filter(e => e.organization_id === currentUser.organization_id);
    return events.filter(e => currentUser.assigned_events.includes(e.id));
  }, [events, currentRole, currentUser]);

  const canAccessEvent = useCallback((eventId: string) => {
    if (currentRole === 'superadmin') return true;
    if (currentRole === 'admin') {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: data.event_id,
        first_name: firstName,
        last_name: lastName,
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
  }, []);

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

  const createEvent = useCallback((e: Omit<Event, 'id'>) => {
    const newId = `evt-${Date.now()}`;
    setEvents(prev => [...prev, { ...e, id: newId }]);
    if (currentRole === 'editor') {
      setUsers(prev => prev.map(u =>
        u.id === currentUser.id ? { ...u, assigned_events: [...u.assigned_events, newId] } : u
      ));
    }
    addLog(`Utworzono wydarzenie: ${e.name}`);
  }, [addLog, currentRole, currentUser]);

  const addUser = useCallback((u: Omit<User, 'id'>) => {
    setUsers(prev => [...prev, { ...u, id: `u-${Date.now()}` }]);
    addLog(`Dodano uzytkownika: ${u.name}`);
  }, [addLog]);

  const removeUser = useCallback((id: string) => {
    const u = users.find(x => x.id === id);
    setUsers(prev => prev.filter(x => x.id !== id));
    if (u) addLog(`Usunieto uzytkownika: ${u.name}`);
  }, [users, addLog]);

  const changeRole = useCallback((userId: string, role: Role) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  }, []);

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
      createEvent,
      addUser,
      removeUser,
      changeRole,
      markEmailsSent,
      addLog,
      getParticipantsByEvent,
      visibleEvents,
      canAccessEvent,
      isUsingApi,
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
