import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Organizations from '@/pages/Organizations';
import type { Event, Organization, User } from '@/types';

const useDataMock = vi.fn();

vi.mock('@/contexts/DataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

function createUser(role: User['role'] = 'superadmin'): User {
  return {
    id: `${role}-1`,
    name: role === 'admin' ? 'Admin' : 'Super Admin',
    email: `${role}@example.com`,
    password: '',
    role,
    assigned_events: [],
  };
}

function createOrganization(id: string, name: string): Organization {
  return {
    id,
    name,
    event_limit: 4,
  };
}

function createEvent(
  id: string,
  organizationId: string,
  officeOpenAt = '2099-04-12T07:00:00',
  officeCloseAt = '2099-04-12T15:00:00'
): Event {
  return {
    id,
    name: `Wydarzenie ${id}`,
    location: 'Warszawa',
    organization_id: organizationId,
    office_open_at: officeOpenAt,
    office_close_at: officeCloseAt,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderPage(
  organizations: Organization[],
  events?: Event[],
  role: User['role'] = 'superadmin',
  options?: {
    setSelectedOrganizationId?: ReturnType<typeof vi.fn>;
    initialEntry?: string;
  },
) {
  const currentUser = createUser(role);
  const setSelectedOrganizationId = options?.setSelectedOrganizationId ?? vi.fn();

  useDataMock.mockReturnValue({
    organizations,
    archivedEvents: [],
    events: events ?? organizations.map((organization, index) => createEvent(`event-${index + 1}`, organization.id)),
    users: [currentUser],
    currentRole: role,
    currentUser,
    createOrganization: vi.fn(),
    isLoading: false,
    connectionState: 'online',
    setSelectedOrganizationId,
  });

  render(
    <MemoryRouter initialEntries={[options?.initialEntry ?? '/organizations']}>
      <Routes>
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/:id" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );

  return { setSelectedOrganizationId };
}

describe('Organizations page', () => {
  beforeEach(() => {
    useDataMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows search only when there are more than five organizations', () => {
    renderPage([
      createOrganization('org-1', 'Alpha'),
      createOrganization('org-2', 'Beta'),
      createOrganization('org-3', 'Gamma'),
      createOrganization('org-4', 'Delta'),
      createOrganization('org-5', 'Epsilon'),
    ]);

    expect(screen.queryByRole('textbox', { name: 'Szukaj organizacji' })).not.toBeInTheDocument();
  });

  it('filters organizations by name in the table', () => {
    renderPage([
      createOrganization('org-1', 'Alpha'),
      createOrganization('org-2', 'Beta'),
      createOrganization('org-3', 'Gamma Center'),
      createOrganization('org-4', 'Delta'),
      createOrganization('org-5', 'Epsilon'),
      createOrganization('org-6', 'Zeta'),
    ]);

    const searchInput = screen.getByRole('textbox', { name: 'Szukaj organizacji' });
    fireEvent.change(searchInput, { target: { value: 'Gamma' } });

    expect(screen.getByText('Gamma Center')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('shows currently running event window when organization event is in progress', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2099-04-12T10:00:00'));

    renderPage(
      [createOrganization('org-1', 'Alpha')],
      [createEvent('event-1', 'org-1', '2099-04-12T07:00:00', '2099-04-12T15:00:00')]
    );

    expect(screen.getAllByText('W trakcie do 12.04.2099, 15:00')).not.toHaveLength(0);
  });

  it('does not require selecting a single admin when creating organization as superadmin', () => {
    renderPage([createOrganization('org-1', 'Alpha')]);

    fireEvent.click(screen.getByRole('button', { name: 'Nowa organizacja' }));

    expect(screen.queryByLabelText('Administrator organizacji')).not.toBeInTheDocument();
  });

  it('shows all organizations for admin', () => {
    renderPage(
      [
        createOrganization('org-1', 'Alpha'),
        createOrganization('org-2', 'Beta'),
      ],
      undefined,
      'admin',
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('syncs admin organization context before navigating to organization details', () => {
    const setSelectedOrganizationId = vi.fn();

    renderPage(
      [
        createOrganization('org-1', 'Alpha'),
        createOrganization('org-2', 'Beta'),
      ],
      undefined,
      'admin',
      { setSelectedOrganizationId },
    );

    fireEvent.click(screen.getByText('Beta'));

    expect(setSelectedOrganizationId).toHaveBeenCalledWith('org-2');
    expect(screen.getByTestId('location-display').textContent).toBe('/organizations/org-2');
  });
});
