'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';

export default function OwnerDashboard() {
  const t = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && !authLoading) {
      // Redirect to boats page as default for owner dashboard
      // This is a simple redirect, but we could use redirectAfterAuth for consistency
      // However, since this is specifically the dashboard route, we'll keep it simple
      router.push('/owner/boats');
    }
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-xl">{t('loading')}</div>
    </div>
  );
}
