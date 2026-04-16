import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/contexts/DataContext';
import { clearOfflineData, saveBootstrapSnapshot } from '@/lib/offline-store';
import type { User } from '@/types';

const authState: {
  user: User | null;
  token: string | null;
  clearSession: ReturnType<typeof vi.fn>;
  getAuthHeaders: ReturnType<typeof vi.fn>;
} = {
  user: {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@example.com',
    password: '',
    role: 'admin',
    organization_ids: ['org-1'],
    assigned_events: [],
  },
  token: 'token',
  clearSession: vi.fn(),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer token' })),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

function OfflineConsumer() {
  const {
    participants,
    snapshotSource,
    connectionState,
    pendingMutationCount,
    updateParticipantStatus,
  } = useData();

  const participant = participants[0];

  return (
    <div>
      <div data-testid="snapshot-source">{snapshotSource}</div>
      <div data-testid="connection-state">{connectionState}</div>
      <div data-testid="pending-count">{pendingMutationCount}</div>
      <div data-testid="participant-status">{participant?.status ?? ''}</div>
      <div data-testid="participant-sync">{participant?.sync_state ?? ''}</div>
      <button
        type="button"
        onClick={() => {
          if (!participant) {
            return;
          }
          void updateParticipantStatus(participant.id, 'checked_in', { allowOfflineQueue: true });
        }}
      >
        queue-status
      </button>
    </div>
  );
}

describe('DataProvider offline cache and queue', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await clearOfflineData('http://localhost:8080', 'admin-1');
    authState.clearSession.mockReset();
    authState.getAuthHeaders.mockReset();
    authState.getAuthHeaders.mockReturnValue({ Authorization: 'Bearer token' });
    authState.user = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      organization_ids: ['org-1'],
      assigned_events: [],
    };
    authState.token = 'token';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores the latest bootstrap snapshot after a network failure', async () => {
    await saveBootstrapSnapshot({
      key: 'http://localhost:8080::admin-1',
      apiBaseUrl: 'http://localhost:8080',
      userId: 'admin-1',
      savedAt: '2099-04-12T07:00:00.000Z',
      generatedAt: '2099-04-12T07:00:00.000Z',
      snapshotVersion: 'snapshot-1',
      selectedOrganizationId: 'org-1',
      selectedEventId: 'event-1',
      data: {
        organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5, admin_users: [] }],
        events: [{
          id: 'event-1',
          name: 'Event 1',
          location: 'Warsaw',
          organization_id: 'org-1',
          office_open_at: '2099-04-12T07:00:00',
          office_close_at: '2099-04-12T15:00:00',
        }],
        archivedEvents: [],
        users: [authState.user!],
        participants: [{
          id: 'p-1',
          event_id: 'event-1',
          name: 'Anna Test',
          email: 'anna@example.com',
          bib_number: '101',
          qr_code: 'QR-101',
          status: 'not_checked_in',
          email_status: 'not_sent',
          custom_fields: {},
          sync_state: 'synced',
        }],
        activityLog: [],
      },
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network down');
    }));

    render(
      <DataProvider>
        <OfflineConsumer />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('snapshot-source').textContent).toBe('cache'));
    expect(screen.getByTestId('connection-state').textContent).toMatch(/degraded|offline/);
    expect(screen.getByTestId('participant-status').textContent).toBe('not_checked_in');
  });

  it('queues scanner status mutations while offline and marks them as pending sync', async () => {
    await saveBootstrapSnapshot({
      key: 'http://localhost:8080::admin-1',
      apiBaseUrl: 'http://localhost:8080',
      userId: 'admin-1',
      savedAt: '2099-04-12T07:00:00.000Z',
      generatedAt: '2099-04-12T07:00:00.000Z',
      snapshotVersion: 'snapshot-2',
      selectedOrganizationId: 'org-1',
      selectedEventId: 'event-1',
      data: {
        organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5, admin_users: [] }],
        events: [{
          id: 'event-1',
          name: 'Event 1',
          location: 'Warsaw',
          organization_id: 'org-1',
          office_open_at: '2099-04-12T07:00:00',
          office_close_at: '2099-04-12T15:00:00',
        }],
        archivedEvents: [],
        users: [authState.user!],
        participants: [{
          id: 'p-1',
          event_id: 'event-1',
          name: 'Anna Test',
          email: 'anna@example.com',
          bib_number: '101',
          qr_code: 'QR-101',
          status: 'not_checked_in',
          email_status: 'not_sent',
          custom_fields: {},
          sync_state: 'synced',
        }],
        activityLog: [],
      },
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network down');
    }));

    render(
      <DataProvider>
        <OfflineConsumer />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('snapshot-source').textContent).toBe('cache'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'queue-status' }));
    });

    await waitFor(() => expect(screen.getByTestId('pending-count').textContent).toBe('1'));
    expect(screen.getByTestId('participant-status').textContent).toBe('checked_in');
    expect(screen.getByTestId('participant-sync').textContent).toBe('pending_sync');
  });
}
