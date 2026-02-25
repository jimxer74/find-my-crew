'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@shared/logging';
import { getSupabaseBrowserClient } from '@shared/database/client';
import type { User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        logger.debug('[AuthContext] Initial session loaded', { hasSession: !!session, userId: session?.user?.id });
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((error) => {
        logger.error('[AuthContext] Failed to get initial session:', error instanceof Error ? { error: error.message } : { error: String(error) });
        setUser(null);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('[AuthContext] onAuthStateChange event', { event, hasSession: !!session, userId: session?.user?.id });
      setUser(session?.user ?? null);
      setLoading(false);

      // Redirect to home page on logout
      // Use window.location for a hard redirect to ensure we go to landing page
      if (event === 'SIGNED_OUT') {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        } else {
          router.push('/');
          router.refresh();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();

    try {
      logger.debug('[AuthContext] Signing out user', {});
      // Use Promise.race to add timeout protection (3 seconds)
      // Prevents hanging if Supabase auth service is slow or offline
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sign out timeout')), 3000)
        )
      ] as [Promise<{ error: Error | null }>, Promise<never>]);
      logger.debug('[AuthContext] signOut completed, redirecting to /', {});
    } catch (error: any) {
      logger.warn('[AuthContext] signOut failed or timed out, forcing redirect anyway', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with redirect even if signOut fails
    }

    // Always redirect, even if signOut failed
    // This ensures user is logged out visually even if Supabase session cleanup fails
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      router.replace('/');
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
