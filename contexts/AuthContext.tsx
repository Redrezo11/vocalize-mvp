import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fullTestCache } from '../utils/testCache';

const API_BASE = '/api';

type RefreshResult = 'ok' | 'unauthorized' | 'error';

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
  const refreshInFlightRef = useRef<Promise<RefreshResult> | null>(null);

  // Single-flight refresh: concurrent callers (mount check, visibility, interval, two tabs)
  // share one request. Only a definite 401 means the session is gone; network errors and
  // 5xx (sleeping Heroku dyno) are transient and must not log the user out.
  const refreshSession = useCallback((): Promise<RefreshResult> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const p: Promise<RefreshResult> = fetch(`${API_BASE}/auth/refresh`, { method: 'POST' })
      .then(res => (res.ok ? 'ok' : res.status === 401 ? 'unauthorized' : 'error'))
      .catch(() => 'error' as RefreshResult)
      .finally(() => { refreshInFlightRef.current = null; });
    refreshInFlightRef.current = p;
    return p;
  }, []);

  // Start auto-refresh interval (every 14 minutes, tokens expire at 15)
  const startAutoRefresh = useCallback(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = setInterval(async () => {
      if ((await refreshSession()) === 'unauthorized') {
        setUser(null);
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      }
    }, 14 * 60 * 1000);
  }, [refreshSession]);

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
          if ((await refreshSession()) === 'ok') {
            res = await fetch(`${API_BASE}/auth/me`);
          }
        }
        if (res.ok) {
          const data = await res.json();
          console.log('[Auth] checkSession data:', { role: data.role, token_balance: data.token_balance, tokens_used: data.tokens_used });
          setUser({ id: data.id, username: data.username, name: data.name, role: data.role, tokenBalance: data.role === 'admin' ? (data.tokens_used ?? 0) : (data.token_balance ?? 0) });
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
  }, [refreshSession, startAutoRefresh, stopAutoRefresh]);

  // When the tab becomes visible again (browser suspends intervals in background), check the
  // session and refresh only if the access token has actually expired. iOS fires this on every
  // app switch and screen unlock, so keep it cheap and never log out on a transient failure.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !user) return;
      try {
        const me = await fetch(`${API_BASE}/auth/me`);
        if (me.ok || me.status !== 401) return; // still valid, or a transient server error
      } catch {
        return; // offline — keep the session, next check will retry
      }
      if ((await refreshSession()) === 'unauthorized') {
        setUser(null);
        stopAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, refreshSession, stopAutoRefresh]);

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
      console.log('[Auth] login data:', { role: u.role, token_balance: u.token_balance, tokens_used: u.tokens_used });
      setUser({ id: u.id, username: u.username, name: u.name, role: u.role, tokenBalance: u.role === 'admin' ? (u.tokens_used ?? 0) : (u.token_balance ?? 0) });
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
