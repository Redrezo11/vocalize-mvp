import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fullTestCache } from '../utils/testCache';

const API_BASE = '/api';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'teacher';
  tokenBalance: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateTokenBalance: (balance: number) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  updateTokenBalance: () => {},
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

  // Check existing session on mount (with refresh fallback for expired access tokens)
  useEffect(() => {
    const checkSession = async () => {
      try {
        let res = await fetch(`${API_BASE}/auth/me`);
        if (!res.ok) {
          // Access token expired — try refreshing with 7-day refresh token
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST' });
          if (refreshRes.ok) {
            res = await fetch(`${API_BASE}/auth/me`);
          }
        }
        if (res.ok) {
          const data = await res.json();
          setUser({ id: data.id, username: data.username, name: data.name, role: data.role, tokenBalance: data.token_balance ?? 0 });
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

  // Proactively refresh tokens when tab becomes visible (browser suspends intervals in background)
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === 'visible' && user) {
        try {
          const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST' });
          if (!res.ok) {
            setUser(null);
            stopAutoRefresh();
          }
        } catch {
          // Network error — don't log out, will retry
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, stopAutoRefresh]);

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
      const u = data.user;
      setUser({ id: u.id, username: u.username, name: u.name, role: u.role, tokenBalance: u.token_balance ?? 0 });
      startAutoRefresh();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [startAutoRefresh]);

  const updateTokenBalance = useCallback((balance: number) => {
    setUser(prev => prev ? { ...prev, tokenBalance: balance } : null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // Logout even if server call fails
    }
    setUser(null);
    stopAutoRefresh();
    // Clear all session/cache data to prevent leaking to next user
    try { sessionStorage.clear(); } catch {}
    fullTestCache.clear();
  }, [stopAutoRefresh]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateTokenBalance }}>
      {children}
    </AuthContext.Provider>
  );
};
