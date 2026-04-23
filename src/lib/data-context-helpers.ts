import type { ActivityLog, ConnectionState, Event, Organization, Participant, ParticipantStatus, User } from '@/types';
import type { OfflineBootstrapSnapshot, PendingParticipantMutation } from '@/lib/offline-store';
import { API_BASE_URL } from '@/lib/api';
import { normalizeParticipantStatus } from '@/lib/participant-status';
import { isEventOfficeOpen } from '@/lib/events';

export const SELECTED_ORGANIZATION_STORAGE_KEY_PREFIX = 'selected_organization_context';
export const SELECTED_EVENT_STORAGE_KEY_PREFIX = 'selected_event_context';
export const DEVICE_ID_STORAGE_KEY = 'offline_device_id';
export const OFFLINE_ACTION_MESSAGE = 'Ta operacja jest dostępna tylko po połączeniu z serwerem. Aplikacja działa teraz na danych z pamięci lokalnej.';

export interface ApiParticipant {
  id: number | string;
  event_id: string | null;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  email: string;
  bib_number: string | null;
  qr_code: string | null;
  custom_fields?: Record<string, string> | null;
  status: ParticipantStatus | 'pending' | null;
  email_status: 'not_sent' | 'sent' | null;
  checked_in_at: string | null;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: User['role'];
  organization_id?: string | null;
  assigned_events: string[];
}

export type ApiEvent = Event;
export type ApiOrganization = Organization;

export interface BootstrapResponse {
  generated_at?: string;
  snapshot_version?: string;
  data: {
    organizations: ApiOrganization[];
    events: ApiEvent[];
    archivedEvents?: ApiEvent[];
    users: ApiUser[];
    participants: ApiParticipant[];
    activityLog: ActivityLog[];
  };
}

export function mapApiOrganizationToUi(organization: ApiOrganization): Organization {
  return { ...organization };
}

export interface ParticipantQrPreviewResponse {
  data?: {
    participant?: ApiParticipant;
    event?: ApiEvent;
    qr_code_svg_data_uri?: string;
    qr_code_image_url?: string;
  };
  error?: string;
}

export interface ParticipantScanApiResponse {
  data?: {
    participant?: ApiParticipant;
    event?: ApiEvent;
    access?: { allowed?: boolean };
  };
  error?: string;
}

export function getSelectedOrganizationStorageKey(userId: string) {
  return `${SELECTED_ORGANIZATION_STORAGE_KEY_PREFIX}:${userId}`;
}

function readStoredContextValue(key: string): string {
  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
  } catch {
    // Ignore unavailable sessionStorage.
  }

  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function persistStoredContextValue(key: string, value: string): void {
  let persistedInSession = false;

  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
    persistedInSession = true;
  } catch {
    // Ignore unavailable sessionStorage and fall back below.
  }

  try {
    if (persistedInSession) {
      localStorage.removeItem(key);
      return;
    }

    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Ignore unavailable localStorage.
  }
}

export function readStoredSelectedOrganizationId(userId?: string | null): string {
  if (!userId) return '';

  return readStoredContextValue(getSelectedOrganizationStorageKey(userId));
}

export function getSelectedEventStorageKey(userId: string) {
  return `${SELECTED_EVENT_STORAGE_KEY_PREFIX}:${userId}`;
}

export function readStoredSelectedEventId(userId?: string | null): string {
  if (!userId) return '';

  return readStoredContextValue(getSelectedEventStorageKey(userId));
}

export function persistStoredSelectedOrganizationId(userId: string, organizationId: string): void {
  persistStoredContextValue(getSelectedOrganizationStorageKey(userId), organizationId);
}

export function persistStoredSelectedEventId(userId: string, eventId: string): void {
  persistStoredContextValue(getSelectedEventStorageKey(userId), eventId);
}

type ParticipantLike = Partial<ApiParticipant> & Partial<Participant>;

function toTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function normalizeCustomFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, toTrimmedString(fieldValue)])
  );
}

export function mapApiParticipantToUi(participant: ParticipantLike | null | undefined, fallbackEventId: string): Participant {
  const eventId = toTrimmedString(participant?.event_id) || fallbackEventId;
  const displayName = toTrimmedString(participant?.display_name);
  const cachedName = toTrimmedString(participant?.name);
  const firstName = toTrimmedString(participant?.first_name);
  const lastName = toTrimmedString(participant?.last_name);
  const fallbackName = [firstName, lastName].filter(Boolean).join(' ');
  const email = toTrimmedString(participant?.email);
  const bibNumber = toTrimmedString(participant?.bib_number);
  const qrCode = toTrimmedString(participant?.qr_code);
  const checkedInAt = toTrimmedString(participant?.checked_in_at);
  const participantId = toTrimmedString(participant?.id);
  const normalizedId = participantId.startsWith('p-')
    ? participantId
    : `p-${participantId || 'unknown'}`;

  return {
    id: normalizedId,
    event_id: eventId,
    name: displayName || cachedName || fallbackName || email || 'Nieznany uczestnik',
    email,
    bib_number: bibNumber,
    qr_code: qrCode,
    status: normalizeParticipantStatus(toTrimmedString(participant?.status) || undefined),
    email_status: participant?.email_status === 'sent' ? 'sent' : 'not_sent',
    checked_in_at: checkedInAt || undefined,
    custom_fields: normalizeCustomFields(participant?.custom_fields),
    sync_state: 'synced',
    sync_error: undefined,
  };
}

export function participantUiIdToApiId(participantId: string): string {
  return participantId.startsWith('p-') ? participantId.slice(2) : participantId;
}

export function mapApiUserToUi(user: ApiUser): User {
  return {
    ...user,
    password: '',
    organization_id: user.organization_id ?? undefined,
    assigned_events: Array.isArray(user.assigned_events) ? user.assigned_events : [],
  };
}

export function getDefaultCurrentUser(): User {
  return { id: '', name: '', email: '', password: '', role: 'scanner', assigned_events: [] };
}

export function getSelectableOrganizationsForUser(allOrganizations: Organization[], user: User): Organization[] {
  if (user.role !== 'admin') return [];
  return allOrganizations;
}

export function getVisibleEventsForUser(allEvents: Event[], user: User, now = new Date()): Event[] {
  const activeEvents = allEvents.filter(event => !event.archived_at && !event.deleted_at);
  if (user.role === 'superadmin') return activeEvents;
  if (user.role === 'admin') return activeEvents;
  if (user.role === 'editor') return activeEvents.filter(event => event.organization_id === user.organization_id);
  return activeEvents.filter(event => user.assigned_events.includes(event.id) && isEventOfficeOpen(event, now));
}

export function resolveSelectedOrganizationId(availableOrganizations: Organization[], preferredSelectedOrganizationId: string): string {
  return availableOrganizations.some(organization => organization.id === preferredSelectedOrganizationId)
    ? preferredSelectedOrganizationId
    : availableOrganizations[0]?.id ?? '';
}

export function resolveSelectedEventId(availableEvents: Event[], preferredSelectedEventId: string): string {
  return availableEvents.some(event => event.id === preferredSelectedEventId)
    ? preferredSelectedEventId
    : availableEvents[0]?.id ?? '';
}

export function createClientMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = `device-${createClientMutationId()}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `device-${createClientMutationId()}`;
  }
}

export function getInitialConnectionState(): ConnectionState {
  if (typeof navigator === 'undefined') return 'online';
  return navigator.onLine ? 'online' : 'offline';
}

export function applyPendingMutations(participants: Participant[], pendingMutations: PendingParticipantMutation[]): Participant[] {
  const latestMutationByParticipant = pendingMutations.reduce<Map<string, PendingParticipantMutation>>((accumulator, mutation) => {
    accumulator.set(mutation.participantId, mutation);
    return accumulator;
  }, new Map());

  return participants.map(participant => {
    const mutation = latestMutationByParticipant.get(participant.id);
    if (!mutation) {
      return { ...participant, sync_state: 'synced', sync_error: undefined };
    }

    if (mutation.state === 'requires_review') {
      return { ...participant, sync_state: 'requires_review', sync_error: mutation.error };
    }

    return {
      ...participant,
      status: mutation.nextStatus,
      checked_in_at: mutation.nextStatus === 'not_checked_in' ? undefined : (participant.checked_in_at ?? mutation.queuedAt),
      sync_state: 'pending_sync',
      sync_error: undefined,
    };
  });
}

export function buildOfflineSnapshot(args: {
  userId: string;
  selectedOrganizationId: string;
  selectedEventId: string;
  organizations: Organization[];
  events: Event[];
  archivedEvents: Event[];
  users: User[];
  participants: Participant[];
  activityLog: ActivityLog[];
  generatedAt: string;
  snapshotVersion: string;
}): OfflineBootstrapSnapshot {
  return {
    key: `${API_BASE_URL}::${args.userId}`,
    apiBaseUrl: API_BASE_URL,
    userId: args.userId,
    savedAt: args.generatedAt,
    generatedAt: args.generatedAt,
    snapshotVersion: args.snapshotVersion,
    selectedOrganizationId: args.selectedOrganizationId,
    selectedEventId: args.selectedEventId,
    data: {
      organizations: args.organizations.map(mapApiOrganizationToUi),
      events: args.events,
      archivedEvents: args.archivedEvents,
      users: args.users,
      participants: args.participants.map(participant => ({ ...participant, sync_state: 'synced', sync_error: undefined })),
      activityLog: args.activityLog,
    },
  };
}

export function createBootstrapSnapshotVersion(response: BootstrapResponse['data']): string {
  return createSnapshotVersion({
    organizations: (response.organizations ?? []).map(mapApiOrganizationToUi),
    events: response.events ?? [],
    archivedEvents: response.archivedEvents ?? [],
    users: (response.users ?? []).map(mapApiUserToUi),
    participants: (response.participants ?? []).map(participant => mapApiParticipantToUi(participant, '')),
    activityLog: Array.isArray(response.activityLog) ? response.activityLog : [],
  });
}

export function extractConflictParticipant(errorPayload: unknown): ApiParticipant | null {
  if (!errorPayload || typeof errorPayload !== 'object') return null;
  if ('data' in errorPayload && errorPayload.data && typeof errorPayload.data === 'object' && 'id' in errorPayload.data) {
    return errorPayload.data as ApiParticipant;
  }
  return null;
}
