import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/contexts/DataContext';
import type { Event, Organization, User } from '@/types';

const authState: {
  user: User | null;
  token: string | null;
  clearSession: ReturnType<typeof vi.fn>;
  getAuthHeaders: ReturnType<typeof vi.fn>;
} = {
  user: null,
  token: 'token',
  clearSession: vi.fn(),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer token' })),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

function TestConsumer() {
  const { selectedOrganizationId, setSelectedOrganizationId, selectedEventId, visibleEvents, setSelectedEventId } = useData();

  return (
    <div>
      <div data-testid="selected-organization">{selectedOrganizationId}</div>
      <div data-testid="selected-event">{selectedEventId}</div>
      <div data-testid="visible-events-count">{visibleEvents.length}</div>
      <button type="button" onClick={() => setSelectedOrganizationId('org-1')}>
        select-org-1
      </button>
      <button type="button" onClick={() => setSelectedOrganizationId('org-2')}>
        select-org-2
      </button>
      <button type="button" onClick={() => setSelectedEventId('event-2')}>
        select-event-2
      </button>
    </div>
  );
}

function createEvent(id: string, organizationId = 'org-1'): Event {
  return {
    id,
    name: `Event ${id}`,
    location: 'Warsaw',
    organization_id: organizationId,
    office_open_at: '2099-04-12T07:00:00',
    office_close_at: '2099-04-12T15:00:00',
  };
}

function createOrganization(id: string): Organization {
  return {
    id,
    name: `Organization ${id}`,
    event_limit: 5,
    admin_users: [],
  };
}

function createBootstrapResponse(user: User, events: Event[], organizations: Organization[] = []) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => ({
      generated_at: '2099-04-12T07:00:00.000Z',
      snapshot_version: 'snapshot-test',
      data: {
        organizations,
        events,
        users: [user],
        participants: [],
        activityLog: [],
      },
    }),
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('DataProvider bootstrap loading', () => {
  beforeEach(() => {
    authState.user = null;
    authState.token = 'token';
    authState.clearSession.mockReset();
    authState.getAuthHeaders.mockReset();
    authState.getAuthHeaders.mockReturnValue({ Authorization: 'Bearer token' });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not loop bootstrap requests when scanner has no active events', async () => {
    const scannerUser: User = {
      id: 'scanner-1',
      name: 'Scanner',
      email: 'scanner@example.com',
      password: '',
      role: 'scanner',
      assigned_events: [],
    };

    authState.user = scannerUser;

    const fetchMock = vi.fn(async () => createBootstrapResponse(scannerUser, [createEvent('event-1')]));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('visible-events-count').textContent).toBe('0'));
    await flushEffects();

    expect(screen.getByTestId('selected-event')).toBeEmptyDOMElement();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch bootstrap when user only changes selected event', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'superadmin',
      assigned_events: [],
      organization_ids: [],
    };

    authState.user = adminUser;
    window.localStorage.setItem('selected_event_context:admin-1', 'event-1');

    const fetchMock = vi.fn(async () => createBootstrapResponse(adminUser, [createEvent('event-1'), createEvent('event-2')]));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-1'));
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: 'select-event-2' }));
    await flushEffects();

    expect(screen.getByTestId('selected-event').textContent).toBe('event-2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('remembers selected organization for admin and scopes selected event to it', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
      organization_ids: ['org-1', 'org-2'],
    };

    authState.user = adminUser;
    window.localStorage.setItem('selected_organization_context:admin-1', 'org-2');
    window.localStorage.setItem('selected_event_context:admin-1', 'event-2');

    const organizations = [createOrganization('org-1'), createOrganization('org-2')];
    const fetchMock = vi.fn(async () => createBootstrapResponse(adminUser, [createEvent('event-1', 'org-1'), createEvent('event-2', 'org-2')], organizations));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-organization').textContent).toBe('org-2'));
    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-2'));

    fireEvent.click(screen.getByRole('button', { name: 'select-org-1' }));
    await flushEffects();

    expect(screen.getByTestId('selected-organization').textContent).toBe('org-1');
    expect(screen.getByTestId('selected-event').textContent).toBe('event-1');
    expect(window.localStorage.getItem('selected_organization_context:admin-1')).toBe('org-1');
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBe('event-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears selected event when admin selects organization without events', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
      organization_ids: ['org-1', 'org-2'],
    };

    authState.user = adminUser;
    window.localStorage.setItem('selected_organization_context:admin-1', 'org-1');
    window.localStorage.setItem('selected_event_context:admin-1', 'event-1');

    const organizations = [createOrganization('org-1'), createOrganization('org-2')];
    const fetchMock = vi.fn(async () => createBootstrapResponse(adminUser, [createEvent('event-1', 'org-1')], organizations));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-1'));

    fireEvent.click(screen.getByRole('button', { name: 'select-org-2' }));
    await flushEffects();

    expect(screen.getByTestId('selected-organization').textContent).toBe('org-2');
    expect(screen.getByTestId('selected-event')).toBeEmptyDOMElement();
    expect(window.localStorage.getItem('selected_organization_context:admin-1')).toBe('org-2');
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
