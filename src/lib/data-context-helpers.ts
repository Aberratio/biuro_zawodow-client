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
  organization_ids?: string[];
  assigned_events: string[];
}

export type ApiEvent = Event;
export type ApiOrganization = Omit<Organization, 'admin_users'> & { admin_users?: Organization['admin_users'] | null };

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
  return {
    ...organization,
    admin_users: Array.isArray(organization.admin_users)
      ? organization.admin_users
          .filter(
            (adminUser): adminUser is Organization['admin_users'][number] =>
              Boolean(adminUser?.id && adminUser.name && adminUser.email),
          )
          .map(adminUser => ({
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
          }))
      : [],
  };
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

export function readStoredSelectedOrganizationId(userId?: string | null): string {
  if (!userId) return '';

  try {
    return localStorage.getItem(getSelectedOrganizationStorageKey(userId)) ?? '';
  } catch {
    return '';
  }
}

export function getSelectedEventStorageKey(userId: string) {
  return `${SELECTED_EVENT_STORAGE_KEY_PREFIX}:${userId}`;
}

export function readStoredSelectedEventId(userId?: string | null): string {
  if (!userId) return '';

  try {
    return localStorage.getItem(getSelectedEventStorageKey(userId)) ?? '';
  } catch {
    return '';
  }
}

export function mapApiParticipantToUi(participant: ApiParticipant, fallbackEventId: string): Participant {
  const eventId = participant.event_id ?? fallbackEventId;

  return {
    id: `p-${participant.id}`,
    event_id: eventId,
    name: (participant.display_name ?? `${participant.first_name} ${participant.last_name}`.trim()).trim(),
    email: participant.email,
    bib_number: participant.bib_number ?? `BIB-${participant.id}`,
    qr_code: participant.qr_code ?? '',
    status: normalizeParticipantStatus(participant.status),
    email_status: participant.email_status ?? 'not_sent',
    checked_in_at: participant.checked_in_at ?? undefined,
    custom_fields: participant.custom_fields ?? {},
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
    organization_ids: Array.isArray(user.organization_ids) ? user.organization_ids : [],
    assigned_events: Array.isArray(user.assigned_events) ? user.assigned_events : [],
  };
}

export function getDefaultCurrentUser(): User {
  return { id: '', name: '', email: '', password: '', role: 'scanner', assigned_events: [] };
}

export function getSelectableOrganizationsForUser(allOrganizations: Organization[], user: User): Organization[] {
  if (user.role !== 'admin') return [];
  return allOrganizations.filter(organization => (user.organization_ids ?? []).includes(organization.id));
}

export function getVisibleEventsForUser(allEvents: Event[], user: User, now = new Date()): Event[] {
  const activeEvents = allEvents.filter(event => !event.archived_at);
  if (user.role === 'superadmin') return activeEvents;
  if (user.role === 'admin') return activeEvents.filter(event => (user.organization_ids ?? []).includes(event.organization_id));
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
