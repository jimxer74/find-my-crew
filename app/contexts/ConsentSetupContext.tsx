'use client';

import { logger } from '@/app/lib/logger';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { ConsentSetupModal } from '../components/auth/ConsentSetupModal';

// Pages where the consent modal should not be displayed
const CONSENT_MODAL_EXCLUDED_PATHS = ['/privacy-policy', '/terms-of-service'];

type ConsentSetupContextType = {
  needsConsentSetup: boolean;
  isLoading: boolean;
};

const ConsentSetupContext = createContext<ConsentSetupContextType>({
  needsConsentSetup: false,
  isLoading: true,
});

export function ConsentSetupProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [needsConsentSetup, setNeedsConsentSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Don't show modal on excluded pages (privacy policy, terms of service)
  const isExcludedPath = CONSENT_MODAL_EXCLUDED_PATHS.includes(pathname);

  // Prevent hydration mismatch by only rendering modal after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkConsentSetup = async () => {
      logger.debug('[ConsentSetupContext] Checking consent setup', {
        authLoading,
        hasUser: !!user,
        userId: user?.id,
        pathname,
        isExcludedPath
      });

      if (authLoading) {
        logger.warn('[ConsentSetupContext] ⚠️ Auth still loading, skipping check. This should complete soon.');
        return;
      }

      if (!user) {
        logger.debug('[ConsentSetupContext] No user found, setting needsConsentSetup to false');
        setNeedsConsentSetup(false);
        setIsLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();

      try {
        logger.debug('[ConsentSetupContext] About to query user_consents', { userId: user.id });

        // CRITICAL: Refresh session first to ensure Supabase browser client has latest auth state
        // This is necessary because OAuth callback sets cookies, but browser client might not have synced yet
        // The RLS policy uses auth.uid() which depends on session being current
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          logger.warn('[ConsentSetupContext] Session refresh failed (non-fatal)', { error: refreshError.message });
        } else {
          logger.debug('[ConsentSetupContext] Session refreshed before consent check');
        }

        // Check if user has completed consent setup
        // Query columns that indicate consent completion - privacy_policy and terms are required
        const { data, error } = await supabase
          .from('user_consents')
          .select('privacy_policy_accepted_at, terms_accepted_at')
          .eq('user_id', user.id)
          .maybeSingle();

        logger.debug('[ConsentSetupContext] Consent query result', {
          hasData: !!data,
          hasError: !!error,
          privacyPolicyAccepted: data?.privacy_policy_accepted_at ? 'yes' : 'no',
          termsAccepted: data?.terms_accepted_at ? 'yes' : 'no',
          errorMessage: error?.message
        });

        if (error) {
          logger.error('[ConsentSetupContext] Error checking consent setup:', error instanceof Error ? { error: error.message } : { error: String(error) });
          // On error, show the consent setup modal to be safe
          setNeedsConsentSetup(true);
        } else if (!data) {
          // No consent record exists - user needs to complete setup
          logger.info('[ConsentSetupContext] No consent record found - showing modal');
          setNeedsConsentSetup(true);
        } else {
          // User needs setup if required consents (privacy policy AND terms) are not accepted
          const hasRequiredConsents = data.privacy_policy_accepted_at && data.terms_accepted_at;
          logger.info('[ConsentSetupContext] Consent record found', {
            hasRequiredConsents,
            needsSetup: !hasRequiredConsents
          });
          setNeedsConsentSetup(!hasRequiredConsents);
        }
      } catch (err) {
        logger.error('[ConsentSetupContext] Error checking consent setup:', err instanceof Error ? { error: err.message } : { error: String(err) });
        // On error, show the consent setup modal to be safe
        setNeedsConsentSetup(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkConsentSetup();
  }, [user, authLoading]);

  const handleConsentComplete = () => {
    setNeedsConsentSetup(false);
  };

  const shouldShowModal = mounted && !authLoading && !isLoading && user && needsConsentSetup && !isExcludedPath;

  logger.debug('[ConsentSetupContext] Render condition check', {
    mounted,
    authLoading,
    isLoading,
    hasUser: !!user,
    needsConsentSetup,
    isExcludedPath,
    shouldShowModal
  });

  return (
    <ConsentSetupContext.Provider value={{ needsConsentSetup, isLoading }}>
      {children}
      {/* Show consent setup modal if needed - only after client mount to prevent hydration mismatch */}
      {/* Don't show on privacy-policy or terms-of-service pages so users can read them */}
      {shouldShowModal && (
        <>
          {logger.debug('[ConsentSetupContext] Rendering ConsentSetupModal', { userId: user.id })}
          <ConsentSetupModal userId={user.id} onComplete={handleConsentComplete} />
        </>
      )}
    </ConsentSetupContext.Provider>
  );
}

export const useConsentSetup = () => useContext(ConsentSetupContext);
