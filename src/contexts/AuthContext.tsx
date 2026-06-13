import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentSession, logout, syncCurrentSessionWithRemote, type UserSession } from '@/lib/auth-supabase';

interface AuthContextType {
  session: UserSession | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => getCurrentSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    void syncCurrentSessionWithRemote().then((nextSession) => {
      if (alive) setSession(nextSession);
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('smart-tech:local-session') || e.key.includes('smart-tech:isLogged'))) {
        setSession(getCurrentSession());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      alive = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    session,
    loading,
    signOut: async () => {
      logout();
      setSession(null);
    }
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
