import { supabase } from './supabaseClient';

export type AuthCallbackKind = 'recovery' | 'signup';

/** Where confirmation and reset emails send the user. iOS opens the app; the browser stays on this site. */
export function authRedirectTo(): string {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return 'run4fun://auth/callback';
  }
  return `${window.location.origin}/auth/reset`;
}

/** Apply a Supabase email link (implicit tokens or a PKCE code). */
export async function completeAuthCallback(url: string): Promise<AuthCallbackKind | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const type = hash.get('type') ?? parsed.searchParams.get('type');
  const code = parsed.searchParams.get('code');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return type === 'recovery' ? 'recovery' : 'signup';
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return type === 'recovery' ? 'recovery' : 'signup';
}
