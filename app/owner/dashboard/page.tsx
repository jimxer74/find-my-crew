'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && !authLoading) {
      // Redirect to boats page as default
      router.push('/owner/boats');
    }
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-xl">Loading...</div>
    </div>
  );
}
