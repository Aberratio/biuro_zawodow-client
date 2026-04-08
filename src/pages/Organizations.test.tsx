import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Organizations from '@/pages/Organizations';
import type { Event, Organization, User } from '@/types';

const useDataMock = vi.fn();

vi.mock('@/contexts/DataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

function createUser(): User {
  return {
    id: 'superadmin-1',
    name: 'Super Admin',
    email: 'superadmin@example.com',
    password: '',
    role: 'superadmin',
    assigned_events: [],
    organization_ids: [],
  };
}

function createOrganization(id: string, name: string): Organization {
  return {
    id,
    name,
    event_limit: 4,
    admin_user_name: 'Admin organizacji',
  };
}

function createEvent(id: string, organizationId: string): Event {
  return {
    id,
    name: `Wydarzenie ${id}`,
    location: 'Warszawa',
    organization_id: organizationId,
    office_open_at: '2099-04-12T07:00:00',
    office_close_at: '2099-04-12T15:00:00',
  };
}

function renderPage(organizations: Organization[]) {
  const currentUser = createUser();

  useDataMock.mockReturnValue({
    organizations,
    events: organizations.map((organization, index) => createEvent(`event-${index + 1}`, organization.id)),
    users: [currentUser],
    currentRole: 'superadmin',
    currentUser,
    createOrganization: vi.fn(),
    isLoading: false,
  });

  render(
    <MemoryRouter>
      <Organizations />
    </MemoryRouter>
  );
}

describe('Organizations page', () => {
  beforeEach(() => {
    useDataMock.mockReset();
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

  it('filters organizations by name and keeps rows linked to details', () => {
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

    expect(screen.getByRole('link', { name: /Gamma Center/i })).toHaveAttribute('href', '/organizations/org-3');
    expect(screen.queryByRole('link', { name: /Alpha/i })).not.toBeInTheDocument();
  });
});
