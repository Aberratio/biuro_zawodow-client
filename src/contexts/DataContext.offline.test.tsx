import * as React from 'react';
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
    assigned_events: [],
  },
  token: 'token',
  clearSession: vi.fn(),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer token' })),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

function createJsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => payload,
  };
}

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

function FieldMappingsConsumer() {
  const { getParticipantFieldMappings } = useData();
  const [status, setStatus] = React.useState('idle');

  React.useEffect(() => {
    void Promise.all([
      getParticipantFieldMappings('event-1'),
      getParticipantFieldMappings('event-1'),
    ]).then(() => {
      setStatus('loaded');
    }).catch(() => {
      setStatus('failed');
    });
  }, [getParticipantFieldMappings]);

  return <div data-testid="field-mappings-status">{status}</div>;
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
      assigned_events: [],
    };
    authState.token = 'token';
  });

  afterEach(() => {
    vi.useRealTimers();
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
        organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5 }],
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
        organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5 }],
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

  it('recovers from a transient bootstrap failure without a page reload', async () => {
    vi.useFakeTimers();

    await saveBootstrapSnapshot({
      key: 'http://localhost:8080::admin-1',
      apiBaseUrl: 'http://localhost:8080',
      userId: 'admin-1',
      savedAt: '2099-04-12T07:00:00.000Z',
      generatedAt: '2099-04-12T07:00:00.000Z',
      snapshotVersion: 'snapshot-3',
      selectedOrganizationId: 'org-1',
      selectedEventId: 'event-1',
      data: {
        organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5 }],
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
        participants: [],
        activityLog: [],
      },
    });

    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => {
        throw new Error('Temporary outage');
      })
      .mockImplementation(async () => createJsonResponse(200, {
        generated_at: '2099-04-12T08:00:00.000Z',
        snapshot_version: 'snapshot-4',
        data: {
          organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5 }],
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
          participants: [],
          activityLog: [],
        },
      }));

    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <OfflineConsumer />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('connection-state').textContent).toMatch(/degraded|offline/));

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('connection-state').textContent).toBe('online'));
    vi.useRealTimers();
  });

  it('deduplicates participant field mappings requests for the same event', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/bootstrap')) {
        return createJsonResponse(200, {
          generated_at: '2099-04-12T08:00:00.000Z',
          snapshot_version: 'snapshot-5',
          data: {
            organizations: [{ id: 'org-1', name: 'Org 1', event_limit: 5 }],
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
            participants: [],
            activityLog: [],
          },
        });
      }

      if (url.endsWith('/participant-field-mappings')) {
        return createJsonResponse(200, {
          data: {
            mappings: [{
              source_column_name: 'first_name',
              alias: 'Imię',
              field_role: 'display_name_part',
              display_order: 1,
              is_required: true,
              is_active: true,
            }],
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <FieldMappingsConsumer />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('field-mappings-status').textContent).toBe('loaded'));

    const fieldMappingsCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/participant-field-mappings'));
    expect(fieldMappingsCalls).toHaveLength(1);
  });
});
