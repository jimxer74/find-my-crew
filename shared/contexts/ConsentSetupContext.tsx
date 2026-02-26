'use client';

import { logger } from '@shared/logging';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@shared/auth';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { ConsentSetupModal } from '@shared/components/auth/ConsentSetupModal';

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

        // Check if user has completed consent setup
        // Query columns that indicate consent completion - privacy_policy and terms are required
        // IMPORTANT: Wrap in timeout to prevent RLS policy from hanging
        const queryWithTimeout = Promise.race([
          supabase
            .from('user_consents')
            .select('privacy_policy_accepted_at, terms_accepted_at')
            .eq('user_id', user.id)
            .maybeSingle(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('RLS query timeout')), 5000)
          ),
        ]) as Promise<{ data: { privacy_policy_accepted_at?: string | null; terms_accepted_at?: string | null } | null; error: null } | { error: Error; data: null }>;

        const result = await queryWithTimeout;
        const { data, error } = result as any;

        logger.debug('[ConsentSetupContext] Consent query result', {
          hasData: !!data,
          hasError: !!error,
          privacyPolicyAccepted: (data as any)?.privacy_policy_accepted_at ? 'yes' : 'no',
          termsAccepted: (data as any)?.terms_accepted_at ? 'yes' : 'no',
          errorMessage: (error as any)?.message
        });

        if (error) {
          // On query error (e.g. RLS issue, network error) assume consents are already saved.
          // Showing the modal when we're uncertain is worse than silently skipping it — the user
          // would have to re-accept consents they already accepted.
          logger.warn('[ConsentSetupContext] Consent query error (assuming consent OK):', { error: error.message });
          setNeedsConsentSetup(false);
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
        // On timeout or any exception, assume consents are already saved.
        // Showing the modal on a slow query would interrupt users who have already accepted.
        // New users without consents will be caught on the next successful load.
        logger.warn('[ConsentSetupContext] Consent check timeout or exception (assuming consent OK):', {
          error: err instanceof Error ? err.message : String(err)
        });
        setNeedsConsentSetup(false);
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
