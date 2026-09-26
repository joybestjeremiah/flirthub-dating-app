import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Subscription } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  hasActiveSubscription: boolean;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resendVerification: () => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile(data as Profile | null);
  };

  const loadSubscription = async (uid: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', uid)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription(data as Subscription | null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const refreshSubscription = async () => {
    if (user) await loadSubscription(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        Promise.all([
          loadProfile(data.session.user.id),
          loadSubscription(data.session.user.id),
        ]).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await Promise.all([
            loadProfile(newSession.user.id),
            loadSubscription(newSession.user.id),
          ]);
        } else {
          setProfile(null);
          setSubscription(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const resendVerification = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return { error: 'No email address is associated with this account.' };
    const { error } = await supabase.auth.resend({ type: 'signup', email: data.user.email });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const deleteAccount = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return { error: 'You are not signed in.' };
    const { error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${currentSession.access_token}` },
    });
    if (error) return { error: error.message };
    await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
    setSubscription(null);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSubscription(null);
  };

  const hasActiveSubscription =
    !!subscription &&
    subscription.status === 'active' &&
    new Date(subscription.expires_at) > new Date();

  const isAdmin = !!profile?.is_admin;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        subscription,
        hasActiveSubscription,
        isAdmin,
        loading,
        signUp,
        signIn,
        resetPassword,
        resendVerification,
        updatePassword,
        deleteAccount,
        signOut,
        refreshProfile,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
