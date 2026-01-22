'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import Link from 'next/link';
import { MissingFieldsIndicator } from './MissingFieldsIndicator';

type ProfileCompletionBarProps = {
  showLink?: boolean;
  compact?: boolean;
};

export function ProfileCompletionBar({ showLink = true, compact = false }: ProfileCompletionBarProps) {
  const { user } = useAuth();
  const [completionPercentage, setCompletionPercentage] = useState<number | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setHasProfile(false);
      setCompletionPercentage(0);
      return;
    }

    const loadProfileStatus = async () => {
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
    };

    loadProfileStatus();
  }, [user]);

  if (completionPercentage === null) {
    return null;
  }

  // Don't show if profile is complete
  if (completionPercentage === 100) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completionPercentage}%
        </span>
        {showLink && (
          <Link href="/profile" className="text-xs text-primary hover:underline whitespace-nowrap">
            Complete
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hasProfile ? 'Profile Completion' : 'Create Profile'}
        </span>
        <span>{completionPercentage}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      {showLink && (
        <Link
          href="/profile"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          {hasProfile ? 'Complete your profile' : 'Create your profile'}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
      {hasProfile && completionPercentage !== null && completionPercentage < 100 && (
        <div className="mt-2">
          <MissingFieldsIndicator variant="compact" showTitle={false} />
        </div>
      )}
    </div>
  );
}
