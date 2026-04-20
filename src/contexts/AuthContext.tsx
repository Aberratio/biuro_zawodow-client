import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionState, User } from '@/types';
import { isJwtExpired } from '@/lib/auth-token';
import { API_BASE_URL, fetchJson, isApiResponseError, isNetworkRequestError } from '@/lib/api';
import { clearOfflineData } from '@/lib/offline-store';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  sessionState: SessionState;
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
const AUTH_USER_KEY = 'auth_user';
const AUTH_TOKEN_KEY = 'auth_token';
const SESSION_REVALIDATION_INTERVAL_MS = 15_000;

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
  const [sessionState, setSessionState] = useState<SessionState>(() => {
    const initialToken = loadToken();
    if (!initialToken || isJwtExpired(initialToken)) {
      return 'expired';
    }

    return 'online';
  });

  const clearSession = useCallback(() => {
    const currentUserId = user?.id ?? loadUser()?.id ?? null;

    setUser(null);
    setToken(null);
    setSessionState('expired');

    try {
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // Ignore unavailable sessionStorage.
    }

    if (currentUserId) {
      void clearOfflineData(API_BASE_URL, currentUserId);
    }
  }, [user?.id]);

  const persistSession = useCallback((nextUser: User, nextToken: string, nextSessionState: SessionState = 'online') => {
    setUser(nextUser);
    setToken(nextToken);
    setSessionState(nextSessionState);
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

  const revalidateStoredSession = useCallback(async () => {
    const storedToken = loadToken();
    const storedUser = loadUser();

    if (!storedToken || !storedUser) {
      clearSession();
      return;
    }

    if (isJwtExpired(storedToken)) {
      clearSession();
      return;
    }

    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      const nextUser = normalizeUser((payload as AuthMeResponse).data);
      if (!nextUser) {
        clearSession();
        return;
      }

      persistSession(nextUser, storedToken, 'online');
    } catch (error) {
      if (isApiResponseError(error) && (error.status === 401 || error.status === 403)) {
        clearSession();
      } else if (isNetworkRequestError(error)) {
        setUser(storedUser);
        setToken(storedToken);
        setSessionState('offline_cached');
      } else {
        clearSession();
      }
    }
  }, [clearSession, persistSession]);

  useEffect(() => {
    const validateStoredSession = async () => {
      try {
        await revalidateStoredSession();
      } finally {
        setIsAuthLoading(false);
      }
    };

    void validateStoredSession();
  }, [revalidateStoredSession]);

  useEffect(() => {
    if (sessionState !== 'offline_cached' || !user || !token) {
      return undefined;
    }

    const handleOnline = () => {
      void revalidateStoredSession();
    };

    const intervalId = window.setInterval(() => {
      void revalidateStoredSession();
    }, SESSION_REVALIDATION_INTERVAL_MS);

    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [revalidateStoredSession, sessionState, token, user]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const responsePayload = payload as {
        access_token?: string;
        user?: Omit<User, 'password'> & { password?: string };
      };
      const nextUser = normalizeUser(responsePayload.user);

      if (!responsePayload.access_token || !nextUser) {
        clearSession();
        return false;
      }

      persistSession(nextUser, responsePayload.access_token, 'online');
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [clearSession, persistSession]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      return { ok: true, message: (payload as { message?: string }).message };
    } catch (error) {
      if (isApiResponseError(error)) {
        return {
          ok: false,
          error: error.message || 'Nie udało się wysłać linku resetującego.',
        };
      }

      return { ok: false, error: 'Nie udało się połączyć z serwerem.' };
    }
  }, []);

  const resetPassword = useCallback(async (tokenValue: string, password: string, passwordConfirmation: string) => {
    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenValue,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });

      return { ok: true, message: (payload as { message?: string }).message };
    } catch (error) {
      if (isApiResponseError(error)) {
        return {
          ok: false,
          error: error.message || 'Nie udało się zresetować hasła.',
        };
      }

      return { ok: false, error: 'Nie udało się połączyć z serwerem.' };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, newPasswordConfirmation: string) => {
    try {
      const { payload } = await fetchJson(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: newPasswordConfirmation,
        }),
      });

      return { ok: true, message: (payload as { message?: string }).message };
    } catch (error) {
      if (isApiResponseError(error) && error.status === 401) {
        clearSession();
      }

      if (isApiResponseError(error)) {
        return {
          ok: false,
          error: error.message || 'Nie udało się zmienić hasła.',
        };
      }

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
      isAuthenticated: !!token && !!user && sessionState !== 'expired',
      isAuthLoading,
      sessionState,
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
