import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = '/api';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'teacher';
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start auto-refresh interval (every 14 minutes, tokens expire at 15)
  const startAutoRefresh = useCallback(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST' });
        if (!res.ok) {
          setUser(null);
          if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        }
      } catch {
        // Network error — don't log out immediately, let next interval retry
      }
    }, 14 * 60 * 1000);
  }, []);

  const stopAutoRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`);
        if (res.ok) {
          const data = await res.json();
          setUser({ id: data.id, username: data.username, name: data.name, role: data.role });
          startAutoRefresh();
        }
      } catch {
        // No session or network error
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      setUser(data.user);
      startAutoRefresh();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [startAutoRefresh]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // Logout even if server call fails
    }
    setUser(null);
    stopAutoRefresh();
  }, [stopAutoRefresh]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
