import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { authRedirectTo, completeAuthCallback } from '../services/authCallback';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  needsPasswordUpdate: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearPasswordRecovery: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  error: null,
  needsPasswordUpdate: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  requestPasswordReset: async () => {},
  resendSignupConfirmation: async () => {},
  updatePassword: async () => {},
  deleteAccount: async () => {},
  clearPasswordRecovery: () => {},
  clearError: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setNeedsPasswordUpdate(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const applyAuthCallback = useCallback(async (url: string) => {
    const kind = await completeAuthCallback(url);
    if (kind === 'recovery') setNeedsPasswordUpdate(true);
    if (kind && window.location.hash.includes('access_token')) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unlisten: (() => void) | undefined;
    void applyAuthCallback(window.location.href).catch(e => {
      console.warn('Auth callback failed:', e);
    });
    void (async () => {
      try {
        const { isTauri, invoke } = await import('@tauri-apps/api/core');
        if (!(await isTauri())) return;
        const pending = await invoke<string | null>('consume_pending_auth_callback');
        if (pending) await applyAuthCallback(pending);
      } catch {
        // Web, or the command is unavailable.
      }
    })();
    void (async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        if (!(await isTauri())) return;
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('auth-callback', event => {
          void applyAuthCallback(event.payload).catch(e => {
            console.warn('Auth callback failed:', e);
          });
        });
      } catch {
        // Web, or the native event API is unavailable.
      }
    })();
    return () => { unlisten?.(); };
  }, [applyAuthCallback]);

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
      options: {
        data: { display_name: displayName },
        emailRedirectTo: authRedirectTo(),
      },
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

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const msg = 'Cloud features not configured — password reset unavailable.';
      setError(msg);
      throw new Error(msg);
    }
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectTo(),
    });
    if (e) { setError(e.message); throw e; }
  }, []);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const msg = 'Cloud features not configured — confirmation email unavailable.';
      setError(msg);
      throw new Error(msg);
    }
    const { error: e } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirectTo() },
    });
    if (e) { setError(e.message); throw e; }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) { setError(e.message); throw e; }
  }, []);

  const deleteAccount = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      const msg = 'Cloud features not configured — account deletion unavailable.';
      setError(msg);
      throw new Error(msg);
    }
    const { error: e } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (e) {
      let msg = e.message || 'Could not delete account';
      const response = 'context' in e ? (e as { context?: Response }).context : undefined;
      if (response) {
        try {
          const body = await response.clone().json() as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          // Keep the client error message.
        }
      }
      setError(msg);
      throw new Error(msg);
    }
    await supabase.auth.signOut();
  }, []);

  const clearPasswordRecovery = useCallback(() => setNeedsPasswordUpdate(false), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user, session, loading, error, needsPasswordUpdate,
      signUp, signIn, signOut,
      requestPasswordReset, resendSignupConfirmation, updatePassword, deleteAccount,
      clearPasswordRecovery, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
