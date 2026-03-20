import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadUser(): User | null {
  try {
    const stored = sessionStorage.getItem('auth_user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Re-validate against mock users to ensure consistency
    return mockUsers.find(u => u.id === parsed.id) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const login = useCallback((email: string, password: string): boolean => {
    const found = mockUsers.find(u => u.email === email && u.password === password);
    if (!found) return false;
    setUser(found);
    sessionStorage.setItem('auth_user', JSON.stringify(found));
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('auth_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
