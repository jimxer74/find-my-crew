'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { NavigationMenu } from '@/app/components/NavigationMenu';
import { LogoWithText } from '@/app/components/LogoWithText';

export default function CrewDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <LogoWithText />
            <div className="flex items-center">
              <NavigationMenu />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Crew Dashboard</h1>
          <p className="text-muted-foreground">Browse available journeys and manage your applications</p>
        </div>

        <div className="bg-card rounded-lg shadow p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Journey browsing and application features coming soon!
          </p>
          <Link
            href="/"
            className="font-medium text-primary hover:opacity-80"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
