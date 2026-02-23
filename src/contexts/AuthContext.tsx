import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

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
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Restore persisted session
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
      })
      .catch(e => console.warn('getSession failed:', e))
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    
    if (!isSupabaseConfigured) {
      const msg = 'Cloud features not configured — account creation unavailable.';
      setError(msg);
      throw new Error(msg);
    }
    
    const { error: e, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    
    if (e) {
      console.error('Signup error:', e);
      setError(e.message || 'Failed to create account. Check your Supabase configuration.');
      throw e;
    }
    
    // Note: Supabase may require email confirmation, so user might not be immediately signed in
    console.log('Signup successful:', data);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const msg = 'Cloud features not configured — sign in unavailable.';
      setError(msg);
      throw new Error(msg);
    }
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
