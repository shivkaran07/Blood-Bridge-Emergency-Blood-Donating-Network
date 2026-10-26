import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { api, errorMessage } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Me } from '../types/api';

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'
  | 'unconfigured';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  accountType: 'REQUESTER' | 'DONOR';
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  token: string | null;
  me: Me | null;
  error: string | null;
  refreshMe: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email address before signing in. Check your inbox for the confirmation link.';
  }
  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('password should be at least')) {
    return 'Choose a stronger password (at least 8 characters).';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          setStatus('error');
          return;
        }
        setSession(data.session);
        if (!data.session) setStatus('unauthenticated');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(errorMessage(cause));
        setStatus('error');
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setMe(null);
        setError(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const token = session?.access_token ?? null;

  useEffect(() => {
    if (!token) return;
    let active = true;
    setStatus((current) => (current === 'authenticated' ? current : 'loading'));

    api
      .me(token)
      .then((result) => {
        if (!active) return;
        setMe(result);
        setError(null);
        setStatus('authenticated');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setMe(null);
        setError(errorMessage(cause));
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [token]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.me(token);
      if (!mounted.current) return;
      setMe(result);
      setError(null);
      setStatus('authenticated');
    } catch (cause) {
      if (!mounted.current) return;
      setError(errorMessage(cause));
      setStatus('error');
      throw cause;
    }
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Add the VITE_SUPABASE_* values to frontend/.env.');
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(friendlyAuthError(authError.message));
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Add the VITE_SUPABASE_* values to frontend/.env.');
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: input.fullName,
          account_type: input.accountType,
        },
      },
    });
    if (authError) throw new Error(friendlyAuthError(authError.message));
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setMe(null);
    setError(null);
    setStatus(supabase ? 'unauthenticated' : 'unconfigured');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      token,
      me,
      error,
      refreshMe,
      signIn,
      signUp,
      signOut,
    }),
    [status, session, token, me, error, refreshMe, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

/**
 * Requires both an authenticated session and a loaded profile. Returns a token
 * that is guaranteed non-null under the authenticated status.
 */
export function useAuthToken(): string {
  const { token } = useAuth();
  if (!token) throw new Error('An authenticated token is required for this view.');
  return token;
}
