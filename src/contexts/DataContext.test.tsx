import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/contexts/DataContext';
import { useRouteOrganizationContext } from '@/hooks/use-route-organization-context';
import Participants from '@/pages/Participants';
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
  const {
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedEventId,
    selectEventContext,
    visibleEvents,
    setSelectedEventId,
    canAccessEvent,
    canViewEvent,
    createEvent,
  } = useData();

  return (
    <div>
      <div data-testid="selected-organization">{selectedOrganizationId}</div>
      <div data-testid="selected-event">{selectedEventId}</div>
      <div data-testid="visible-events-count">{visibleEvents.length}</div>
      <div data-testid="can-access-event-1">{String(canAccessEvent('event-1'))}</div>
      <div data-testid="can-access-event-2">{String(canAccessEvent('event-2'))}</div>
      <div data-testid="can-view-archived-event">{String(canViewEvent('archived-event-1'))}</div>
      <button type="button" onClick={() => setSelectedOrganizationId('org-1')}>
        select-org-1
      </button>
      <button type="button" onClick={() => setSelectedOrganizationId('org-2')}>
        select-org-2
      </button>
      <button type="button" onClick={() => setSelectedEventId('event-2')}>
        select-event-2
      </button>
      <button type="button" onClick={() => selectEventContext('event-2')}>
        sync-event-2
      </button>
      <button
        type="button"
        onClick={() => {
          void createEvent({
            name: 'Event event-2',
            location: 'Warsaw',
            organization_id: 'org-1',
            office_open_at: '2099-04-12T07:00:00',
            office_close_at: '2099-04-12T15:00:00',
          });
        }}
      >
        create-event-2
      </button>
    </div>
  );
}

function OrganizationRouteSyncProbe() {
  const { id } = useParams<{ id: string }>();
  useRouteOrganizationContext(id ?? '');
  return null;
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

function createArchivedEvent(id: string, organizationId = 'org-1'): Event {
  return {
    ...createEvent(id, organizationId),
    archived_at: '2099-04-13T12:00:00',
  };
}

function createOrganization(id: string): Organization {
  return {
    id,
    name: `Organization ${id}`,
    event_limit: 5,
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
        archivedEvents: [],
        users: [user],
        participants: [],
        activityLog: [],
      },
    }),
  };
}

function createJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function createBootstrapResponseWithArchivedEvents(
  user: User,
  events: Event[],
  archivedEvents: Event[],
  organizations: Organization[] = [],
) {
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
        archivedEvents,
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
    vi.useRealTimers();
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
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/bootstrap'))).toHaveLength(1);
  });

  it('does not refetch bootstrap when user only changes selected event', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'superadmin',
      assigned_events: [],
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
    expect(window.sessionStorage.getItem('selected_event_context:admin-1')).toBe('event-2');
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBeNull();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/bootstrap'))).toHaveLength(1);
  });

  it('keeps locally created events when an older background bootstrap finishes later', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'superadmin',
      assigned_events: [],
    };

    authState.user = adminUser;

    let resolveStaleBootstrap: (response: ReturnType<typeof createBootstrapResponse>) => void = () => undefined;
    const staleBootstrapResponse = new Promise<ReturnType<typeof createBootstrapResponse>>(resolve => {
      resolveStaleBootstrap = resolve;
    });
    let bootstrapCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/bootstrap')) {
        bootstrapCalls += 1;
        if (bootstrapCalls === 1) {
          return createBootstrapResponse(adminUser, [createEvent('event-1')]);
        }

        return staleBootstrapResponse;
      }

      if (url.endsWith('/events') && options?.method === 'POST') {
        return createJsonResponse({ data: createEvent('event-2') }, 201);
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('visible-events-count').textContent).toBe('1'));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'create-event-2' }));
    await waitFor(() => expect(screen.getByTestId('visible-events-count').textContent).toBe('2'));

    await act(async () => {
      resolveStaleBootstrap(createBootstrapResponse(adminUser, [createEvent('event-1')]));
      await staleBootstrapResponse;
    });
    await flushEffects();

    expect(screen.getByTestId('visible-events-count').textContent).toBe('2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the scanner selected event after a page reload while bootstrap is loading', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2099-04-12T10:00:00.000Z'));

    const scannerUser: User = {
      id: 'scanner-1',
      name: 'Scanner',
      email: 'scanner@example.com',
      password: '',
      role: 'scanner',
      assigned_events: ['event-1', 'event-2'],
    };

    authState.user = scannerUser;
    window.localStorage.setItem('selected_event_context:scanner-1', 'event-2');

    const fetchMock = vi.fn(async () => createBootstrapResponse(
      scannerUser,
      [createEvent('event-1'), createEvent('event-2')],
    ));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    expect(screen.getByTestId('selected-event').textContent).toBe('event-2');
    expect(window.localStorage.getItem('selected_event_context:scanner-1')).toBe('event-2');

    await waitFor(() => expect(screen.getByTestId('visible-events-count').textContent).toBe('2'));
    expect(screen.getByTestId('selected-event').textContent).toBe('event-2');
    expect(window.sessionStorage.getItem('selected_event_context:scanner-1')).toBe('event-2');
    expect(window.localStorage.getItem('selected_event_context:scanner-1')).toBeNull();
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
    expect(window.sessionStorage.getItem('selected_organization_context:admin-1')).toBe('org-1');
    expect(window.sessionStorage.getItem('selected_event_context:admin-1')).toBe('event-1');
    expect(window.localStorage.getItem('selected_organization_context:admin-1')).toBeNull();
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBeNull();
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
    expect(window.sessionStorage.getItem('selected_organization_context:admin-1')).toBe('org-2');
    expect(window.sessionStorage.getItem('selected_event_context:admin-1')).toBeNull();
    expect(window.localStorage.getItem('selected_organization_context:admin-1')).toBeNull();
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores external localStorage changes after selecting an event in the current tab', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'superadmin',
      assigned_events: [],
    };

    authState.user = adminUser;
    window.sessionStorage.setItem('selected_event_context:admin-1', 'event-1');

    const fetchMock = vi.fn(async () => createBootstrapResponse(adminUser, [createEvent('event-1'), createEvent('event-2')]));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-1'));

    fireEvent.click(screen.getByRole('button', { name: 'select-event-2' }));
    await flushEffects();

    act(() => {
      window.localStorage.removeItem('selected_event_context:admin-1');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'selected_event_context:admin-1',
        oldValue: 'event-1',
        newValue: null,
        storageArea: window.localStorage,
      }));
    });

    await flushEffects();

    expect(screen.getByTestId('selected-event').textContent).toBe('event-2');
    expect(window.sessionStorage.getItem('selected_event_context:admin-1')).toBe('event-2');
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('syncs admin organization before persisting a route-selected event context', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    };

    authState.user = adminUser;
    window.localStorage.setItem('selected_organization_context:admin-1', 'org-1');
    window.localStorage.setItem('selected_event_context:admin-1', 'event-1');

    const organizations = [createOrganization('org-1'), createOrganization('org-2')];
    const fetchMock = vi.fn(async () => createBootstrapResponse(
      adminUser,
      [createEvent('event-1', 'org-1'), createEvent('event-3', 'org-2'), createEvent('event-2', 'org-2')],
      organizations,
    ));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('selected-organization').textContent).toBe('org-1'));
    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-1'));

    fireEvent.click(screen.getByRole('button', { name: 'sync-event-2' }));

    await waitFor(() => expect(screen.getByTestId('selected-organization').textContent).toBe('org-2'));
    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-2'));

    expect(window.sessionStorage.getItem('selected_organization_context:admin-1')).toBe('org-2');
    expect(window.sessionStorage.getItem('selected_event_context:admin-1')).toBe('event-2');
    expect(window.localStorage.getItem('selected_organization_context:admin-1')).toBeNull();
    expect(window.localStorage.getItem('selected_event_context:admin-1')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps route-selected participants event stable for admin after switching organizations', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    };

    authState.user = adminUser;
    window.localStorage.setItem('selected_organization_context:admin-1', 'org-1');
    window.localStorage.setItem('selected_event_context:admin-1', 'event-1');

    const organizations = [createOrganization('org-1'), createOrganization('org-2')];
    const fetchMock = vi.fn(async () => createBootstrapResponse(
      adminUser,
      [createEvent('event-1', 'org-1'), createEvent('event-3', 'org-2'), createEvent('event-2', 'org-2')],
      organizations,
    ));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/events/event-2/participants']}>
        <DataProvider>
          <Routes>
            <Route path="/events/:id/participants" element={<Participants />} />
          </Routes>
          <TestConsumer />
        </DataProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('selected-organization').textContent).toBe('org-2'));
    await waitFor(() => expect(screen.getByTestId('selected-event').textContent).toBe('event-2'));

    expect(window.sessionStorage.getItem('selected_organization_context:admin-1')).toBe('org-2');
    expect(window.sessionStorage.getItem('selected_event_context:admin-1')).toBe('event-2');
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/bootstrap'))).toHaveLength(1);
  });

  it('syncs admin organization context from organization details route on refresh', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    };

    authState.user = adminUser;
    window.localStorage.setItem(
      'selected_organization_context:admin-1',
      'org-af3457c5f5f9490d',
    );

    const organizations = [
      createOrganization('org-af3457c5f5f9490d'),
      createOrganization('org-98a5894827bb86e2'),
    ];
    const fetchMock = vi.fn(async () =>
      createBootstrapResponse(adminUser, [], organizations),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizations/org-98a5894827bb86e2']}>
        <DataProvider>
          <Routes>
            <Route
              path="/organizations/:id"
              element={<OrganizationRouteSyncProbe />}
            />
          </Routes>
          <TestConsumer />
        </DataProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('selected-organization').textContent).toBe(
        'org-98a5894827bb86e2',
      ),
    );

    expect(window.sessionStorage.getItem('selected_organization_context:admin-1')).toBe(
      'org-98a5894827bb86e2',
    );
    expect(window.localStorage.getItem('selected_organization_context:admin-1')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('syncs admin organization context from archived events route on refresh', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    };

    authState.user = adminUser;
    window.localStorage.setItem(
      'selected_organization_context:admin-1',
      'org-af3457c5f5f9490d',
    );

    const organizations = [
      createOrganization('org-af3457c5f5f9490d'),
      createOrganization('org-98a5894827bb86e2'),
    ];
    const fetchMock = vi.fn(async () =>
      createBootstrapResponse(adminUser, [], organizations),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizations/org-98a5894827bb86e2/archived-events']}>
        <DataProvider>
          <Routes>
            <Route
              path="/organizations/:id/archived-events"
              element={<OrganizationRouteSyncProbe />}
            />
          </Routes>
          <TestConsumer />
        </DataProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('selected-organization').textContent).toBe(
        'org-98a5894827bb86e2',
      ),
    );

    expect(window.sessionStorage.getItem('selected_organization_context:admin-1')).toBe(
      'org-98a5894827bb86e2',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows admin to access active and archived events across all organizations', async () => {
    const adminUser: User = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    };

    authState.user = adminUser;

    const organizations = [createOrganization('org-1'), createOrganization('org-2')];
    const fetchMock = vi.fn(async () => createBootstrapResponseWithArchivedEvents(
      adminUser,
      [createEvent('event-1', 'org-1'), createEvent('event-2', 'org-2')],
      [createArchivedEvent('archived-event-1', 'org-2')],
      organizations,
    ));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DataProvider>
        <TestConsumer />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('visible-events-count').textContent).toBe('2'));

    expect(screen.getByTestId('can-access-event-1').textContent).toBe('true');
    expect(screen.getByTestId('can-access-event-2').textContent).toBe('true');
    expect(screen.getByTestId('can-view-archived-event').textContent).toBe('true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
