import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/contexts/DataContext';
import type { Event, User } from '@/types';

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
  const { selectedEventId, visibleEvents, setSelectedEventId } = useData();

  return (
    <div>
      <div data-testid="selected-event">{selectedEventId}</div>
      <div data-testid="visible-events-count">{visibleEvents.length}</div>
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

function createBootstrapResponse(user: User, events: Event[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        organizations: [],
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
});
