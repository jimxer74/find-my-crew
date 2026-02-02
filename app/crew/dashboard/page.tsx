'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { CrewBrowseMap } from '@/app/components/crew/CrewBrowseMap';
import { ProfileCompletionPrompt } from '@/app/components/profile/ProfileCompletionPrompt';

export default function CrewDashboard() {
  const t = useTranslations('crewDashboard');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLegId = searchParams.get('legId');
  const openRegistration = searchParams.get('register') === 'true';

  // Allow non-signed-in users to browse journeys with limited information
  // No redirect to login - they can browse but will see limited details

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <div className="bg-background flex flex-col overflow-hidden h-[calc(100vh-4rem)]">
      {/* Show profile completion prompt for signed-in users */}
      {user && <ProfileCompletionPrompt variant="banner" showCompletionPercentage={true} />}

      {/* Show notification banner for non-signed-in users */}
      {!user && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <svg
                className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">
                  {t('signInBanner')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/auth/login"
                className="text-sm text-primary hover:underline font-medium px-3 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                {t('signUp')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <CrewBrowseMap
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          initialLegId={initialLegId}
          initialOpenRegistration={openRegistration}
        />
      </main>
    </div>
  );
}
