'use client';

import Link from 'next/link';
import { MissingFieldsIndicator } from './MissingFieldsIndicator';
import { useAuth } from '@/app/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type ProfileCompletionPromptProps = {
  variant?: 'banner' | 'card' | 'inline';
  showCompletionPercentage?: boolean;
};

export function ProfileCompletionPrompt({ 
  variant = 'banner',
  showCompletionPercentage = true 
}: ProfileCompletionPromptProps) {
  const { user } = useAuth();
  const [completionPercentage, setCompletionPercentage] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setHasProfile(false);
      setCompletionPercentage(0);
      setLoading(false);
      return;
    }

    const loadProfileStatus = async () => {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_completion_percentage, roles')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        setHasProfile(true);
        setCompletionPercentage(data.profile_completion_percentage || 0);
      } else {
        setHasProfile(false);
        setCompletionPercentage(0);
      }
      setLoading(false);
    };

    loadProfileStatus();
  }, [user]);

  // Don't render anything while loading to prevent flash
  if (loading) {
    return null;
  }

  // Don't show if profile is complete (100%) or user has roles
  if (completionPercentage === 100 || (hasProfile && completionPercentage !== null && completionPercentage > 80)) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <svg
              className="w-5 h-5 text-primary flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {hasProfile 
                  ? `Complete your profile to unlock all features${showCompletionPercentage && completionPercentage !== null ? ` (${completionPercentage}% complete)` : ''}`
                  : 'Create your profile to see full leg details and register for journeys'}
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {hasProfile ? 'Complete Profile' : 'Create Profile'}
          </Link>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {hasProfile ? 'Complete Your Profile' : 'Create Your Profile'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasProfile
                ? `You're ${completionPercentage}% done! Complete your profile to unlock all features and see full leg details.`
                : 'Create a profile to see exact dates, skipper information, and register for sailing journeys.'}
            </p>
            {showCompletionPercentage && completionPercentage !== null && hasProfile && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Profile Completion</span>
                  <span>{completionPercentage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}
            {hasProfile && completionPercentage !== null && completionPercentage < 100 && (
              <div className="mb-4">
                <MissingFieldsIndicator variant="list" showTitle={false} />
              </div>
            )}
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {hasProfile ? 'Complete Profile' : 'Create Profile'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <div className="text-sm text-muted-foreground">
      <Link href="/profile" className="text-primary hover:underline font-medium">
        {hasProfile ? 'Complete your profile' : 'Create your profile'}
      </Link>
      {' '}to see full details
    </div>
  );
}
