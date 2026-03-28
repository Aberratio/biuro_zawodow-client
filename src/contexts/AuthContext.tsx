import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  resetPassword: (token: string, password: string, passwordConfirmation: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string, newPasswordConfirmation: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  logout: () => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  clearSession: () => void;
}

interface AuthMeResponse {
  data?: Omit<User, 'password'> & { password?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const AUTH_USER_KEY = 'auth_user';
const AUTH_TOKEN_KEY = 'auth_token';

function normalizeUser(user: (Omit<User, 'password'> & { password?: string }) | null | undefined): User | null {
  if (!user?.id || !user.email || !user.role || !user.name) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    organization_id: user.organization_id ?? undefined,
    organization_ids: Array.isArray(user.organization_ids) ? user.organization_ids : [],
    assigned_events: Array.isArray(user.assigned_events) ? user.assigned_events : [],
  };
}

function loadUser(): User | null {
  try {
    const stored = sessionStorage.getItem(AUTH_USER_KEY);
    if (!stored) return null;
    return normalizeUser(JSON.parse(stored) as User);
  } catch {
    return null;
  }
}

function loadToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);
  const [token, setToken] = useState<string | null>(loadToken);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }, []);

  const persistSession = useCallback((nextUser: User, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
    sessionStorage.setItem(AUTH_TOKEN_KEY, nextToken);
  }, []);

  const getAuthHeaders = useCallback((includeJsonContentType = false) => {
    const headers: Record<string, string> = {};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }, [token]);

  useEffect(() => {
    const validateStoredSession = async () => {
      const storedToken = loadToken();
      if (!storedToken) {
        clearSession();
        setIsAuthLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          clearSession();
          setIsAuthLoading(false);
          return;
        }

        const payload = await response.json() as AuthMeResponse;
        const nextUser = normalizeUser(payload.data);
        if (!nextUser) {
          clearSession();
          setIsAuthLoading(false);
          return;
        }

        persistSession(nextUser, storedToken);
      } catch {
        clearSession();
      } finally {
        setIsAuthLoading(false);
      }
    };

    void validateStoredSession();
  }, [clearSession, persistSession]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        clearSession();
        return false;
      }

      const payload = await response.json() as {
        access_token?: string;
        user?: Omit<User, 'password'> & { password?: string };
      };
      const nextUser = normalizeUser(payload.user);

      if (!payload.access_token || !nextUser) {
        clearSession();
        return false;
      }

      persistSession(nextUser, payload.access_token);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [clearSession, persistSession]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };

      if (!response.ok) {
        return {
          ok: false,
          error: payload.error ?? 'Nie udało się wysłać linku resetującego.',
        };
      }

      return { ok: true, message: payload.message };
    } catch {
      return { ok: false, error: 'Nie udało się połączyć z serwerem.' };
    }
  }, []);

  const resetPassword = useCallback(async (tokenValue: string, password: string, passwordConfirmation: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenValue,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };

      if (!response.ok) {
        return {
          ok: false,
          error: payload.error ?? 'Nie udało się zresetować hasła.',
        };
      }

      return { ok: true, message: payload.message };
    } catch {
      return { ok: false, error: 'Nie udało się połączyć z serwerem.' };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, newPasswordConfirmation: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: newPasswordConfirmation,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };

      if (response.status === 401) {
        clearSession();
      }

      if (!response.ok) {
        return {
          ok: false,
          error: payload.error ?? 'Nie udało się zmienić hasła.',
        };
      }

      return { ok: true, message: payload.message };
    } catch {
      return { ok: false, error: 'Nie udało się połączyć z serwerem.' };
    }
  }, [clearSession, getAuthHeaders]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isAuthLoading,
      login,
      forgotPassword,
      resetPassword,
      changePassword,
      logout,
      getAuthHeaders,
      clearSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
