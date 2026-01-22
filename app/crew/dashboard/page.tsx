'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { Header } from '@/app/components/Header';
import { CrewBrowseMap } from '@/app/components/crew/CrewBrowseMap';
import { ProfileCompletionPrompt } from '@/app/components/profile/ProfileCompletionPrompt';

export default function CrewDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Allow non-signed-in users to browse journeys with limited information
  // No redirect to login - they can browse but will see limited details

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />
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
                  Sign in and complete your profile to see full journey details, dates, boat information, and skipper details
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/auth/login"
                className="text-sm text-primary hover:underline font-medium px-3 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <CrewBrowseMap style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />
      </main>
    </div>
  );
}
