'use client';

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
      if (authLoading) return;

      if (!user) {
        setNeedsConsentSetup(false);
        setIsLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();

      try {
        // Check if user has completed consent setup
        // Query columns that indicate consent completion - privacy_policy and terms are required
        const { data, error } = await supabase
          .from('user_consents')
          .select('privacy_policy_accepted_at, terms_accepted_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking consent setup:', JSON.stringify(error, null, 2));
          // On error, show the consent setup modal to be safe
          setNeedsConsentSetup(true);
        } else if (!data) {
          // No consent record exists - user needs to complete setup
          setNeedsConsentSetup(true);
        } else {
          // User needs setup if required consents (privacy policy AND terms) are not accepted
          const hasRequiredConsents = data.privacy_policy_accepted_at && data.terms_accepted_at;
          setNeedsConsentSetup(!hasRequiredConsents);
        }
      } catch (err) {
        console.error('Error checking consent setup:', err);
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

  return (
    <ConsentSetupContext.Provider value={{ needsConsentSetup, isLoading }}>
      {children}
      {/* Show consent setup modal if needed - only after client mount to prevent hydration mismatch */}
      {/* Don't show on privacy-policy or terms-of-service pages so users can read them */}
      {mounted && !authLoading && !isLoading && user && needsConsentSetup && !isExcludedPath && (
        <ConsentSetupModal userId={user.id} onComplete={handleConsentComplete} />
      )}
    </ConsentSetupContext.Provider>
  );
}

export const useConsentSetup = () => useContext(ConsentSetupContext);
