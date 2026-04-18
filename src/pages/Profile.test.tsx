import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Profile from '@/pages/Profile';
import type { Organization, User } from '@/types';

const authState: {
  user: User | null;
  changePassword: ReturnType<typeof vi.fn>;
} = {
  user: null,
  changePassword: vi.fn(),
};

const dataState: {
  organizations: Organization[];
} = {
  organizations: [],
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/DataContext', () => ({
  useData: () => dataState,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('Profile page', () => {
  it('shows all organizations label for admin', () => {
    authState.user = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    };
    dataState.organizations = [
      { id: 'org-1', name: 'Alpha', event_limit: 3 },
      { id: 'org-2', name: 'Beta', event_limit: 5 },
    ];

    render(<Profile />);

    expect(screen.getByText('Organizacja')).toBeInTheDocument();
    expect(screen.getByText('Wszystkie organizacje')).toBeInTheDocument();
  });
});
