'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { FeedbackList } from '@/app/components/feedback/FeedbackList';
import { FeedbackButton } from '@/app/components/feedback/FeedbackButton';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FeedbackPage() {
  const t = useTranslations('feedback');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router  = useRouter();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Beta Disclaimer Banner */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-900 font-semibold">Beta Version</p>
              <p className="text-sm text-yellow-800 mt-1">
                This application is currently in beta testing and is not intended for real-world usage.
                Features may be incomplete, unstable, or subject to change. Your feedback helps us improve!
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
            <p className="text-muted-foreground mt-1">{t('pageDescription')}</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Link
                href="/feedback/my"
                className="text-sm text-primary hover:underline"
              >
                {t('myFeedback')}
              </Link>
            )}
            {user ? (
              <FeedbackButton
                variant="inline"
                contextPage="/feedback"
              />
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
              >
                {t('signInToSubmit')}
              </Link>
            )}
          </div>
        </div>

        {/* Info banner for non-signed-in users */}
        {!user && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-foreground font-medium">{t('guestBannerTitle')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('guestBannerDescription')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback list */}
        <FeedbackList currentUserId={user?.id} />
      </div>
    </div>
  );
}
