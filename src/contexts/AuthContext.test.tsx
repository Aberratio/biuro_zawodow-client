import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createToken(expirationOffsetSeconds: number): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + expirationOffsetSeconds,
  }));

  return `${header}.${payload}.signature`;
}

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

function AuthConsumer() {
  const { isAuthenticated, sessionState, user } = useAuth();

  return (
    <div>
      <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'anonymous'}</div>
      <div data-testid="session-state">{sessionState}</div>
      <div data-testid="user-id">{user?.id ?? ''}</div>
    </div>
  );
}

describe('AuthProvider offline session handling', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a cached session when auth/me fails due to a network problem', async () => {
    const token = createToken(3600);
    window.sessionStorage.setItem('auth_token', token);
    window.sessionStorage.setItem('auth_user', JSON.stringify({
      id: 'user-1',
      name: 'Offline User',
      email: 'offline@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    }));

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network down');
    }));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('session-state').textContent).toBe('offline_cached'));
    expect(screen.getByTestId('auth-state').textContent).toBe('authenticated');
    expect(screen.getByTestId('user-id').textContent).toBe('user-1');
  });

  it('clears the session when auth/me returns 401', async () => {
    const token = createToken(3600);
    window.sessionStorage.setItem('auth_token', token);
    window.sessionStorage.setItem('auth_user', JSON.stringify({
      id: 'user-1',
      name: 'Online User',
      email: 'online@example.com',
      password: '',
      role: 'admin',
      assigned_events: [],
    }));

    vi.stubGlobal('fetch', vi.fn(async () => createJsonResponse(401, { error: 'Unauthorized' })));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('session-state').textContent).toBe('expired'));
    expect(screen.getByTestId('auth-state').textContent).toBe('anonymous');
    expect(screen.getByTestId('user-id').textContent).toBe('');
  });
}
