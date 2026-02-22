import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore persisted session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (e) { setError(e.message); throw e; }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) { setError(e.message); throw e; }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, session, loading, error, signUp, signIn, signOut, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
