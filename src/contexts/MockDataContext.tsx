import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Event, Participant, User, ActivityLog, Role } from '@/types';
import { mockEvents, mockParticipants, mockUsers, mockActivityLog } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';

interface MockDataContextType {
  events: Event[];
  participants: Participant[];
  users: User[];
  activityLog: ActivityLog[];
  currentRole: Role;
  currentUser: User;
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  checkIn: (participantId: string) => void;
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
}

const MockDataContext = createContext<MockDataContextType | null>(null);

export function MockDataProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [participants, setParticipants] = useState<Participant[]>(mockParticipants);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>(mockActivityLog);
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-1');

  const currentUser = useMemo(() => {
    if (!authUser) return users[0];
    return users.find(u => u.id === authUser.id) || users[0];
  }, [users, authUser]);

  const currentRole = currentUser.role;

  // Visible events: superadmin=all, admin=org events, editor/scanner=assigned
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
    const p = participants.find(p => p.id === participantId);
    if (p) addLog('Check-in', p.name);
  }, [participants, addLog]);

  const collectPackage = useCallback((participantId: string) => {
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, package_status: 'collected' as const } : p
    ));
    const p = participants.find(p => p.id === participantId);
    if (p) addLog('Wydano pakiet', p.name);
  }, [participants, addLog]);

  const addParticipant = useCallback((data: Omit<Participant, 'id' | 'qr_code' | 'status' | 'package_status' | 'email_status'>) => {
    const id = `p-${Date.now()}`;
    setParticipants(prev => [...prev, {
      ...data, id,
      qr_code: `QR-${data.event_id}-${Date.now()}`,
      status: 'pending', package_status: 'not_collected', email_status: 'not_sent',
    }]);
    addLog('Dodano uczestnika', data.name);
  }, [addLog]);

  const updateParticipant = useCallback((id: string, data: Partial<Participant>) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const importParticipants = useCallback((data: { name: string; email: string }[], eventId: string) => {
    const existing = participants.filter(p => p.event_id === eventId);
    const existingEmails = new Set(existing.map(p => p.email));
    const valid = data.filter(d => d.email && !existingEmails.has(d.email));
    const maxBib = Math.max(0, ...existing.map(p => parseInt(p.bib_number) || 0));
    const newParticipants: Participant[] = valid.map((d, i) => ({
      id: `p-${Date.now()}-${i}`, event_id: eventId, name: d.name, email: d.email,
      bib_number: String(maxBib + i + 1), qr_code: `QR-${eventId}-${maxBib + i + 1}`,
      status: 'pending' as const, package_status: 'not_collected' as const, email_status: 'not_sent' as const,
    }));
    setParticipants(prev => [...prev, ...newParticipants]);
    addLog(`Import CSV (${newParticipants.length} uczestników)`);
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
    addLog(`Dodano użytkownika: ${u.name}`);
  }, [addLog]);

  const removeUser = useCallback((id: string) => {
    const u = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (u) addLog(`Usunięto użytkownika: ${u.name}`);
  }, [users, addLog]);

  const changeRole = useCallback((userId: string, role: Role) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  }, []);

  const markEmailsSent = useCallback((eventId: string) => {
    setParticipants(prev => prev.map(p =>
      p.event_id === eventId ? { ...p, email_status: 'sent' as const } : p
    ));
    addLog('Wysłano kody QR do wszystkich');
  }, [addLog]);

  const getParticipantsByEvent = useCallback((eventId: string) => {
    return participants.filter(p => p.event_id === eventId);
  }, [participants]);

  return (
    <MockDataContext.Provider value={{
      events, participants, users, activityLog, currentRole, currentUser, selectedEventId,
      setSelectedEventId, checkIn, collectPackage,
      addParticipant, updateParticipant, importParticipants, createEvent,
      addUser, removeUser, changeRole, markEmailsSent, addLog, getParticipantsByEvent,
      visibleEvents, canAccessEvent,
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
