'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { hasFeatureAccess, FeatureName } from '@shared/auth';
import { LimitedAccessIndicator } from '@/app/components/profile/LimitedAccessIndicator';
import Link from 'next/link';
import { useProfile } from '@/app/lib/profile/useProfile';

type FeatureGateProps = {
  feature: FeatureName;
  children: ReactNode;
  fallback?: ReactNode;
  showPrompt?: boolean;
};

export function FeatureGate({
  feature,
  children,
  fallback,
  showPrompt = true
}: FeatureGateProps) {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const [profileStatus, setProfileStatus] = useState<{ exists: boolean; hasRoles: boolean; roles: string[]; completionPercentage: number } | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileStatus({
        exists: false,
        hasRoles: false,
        roles: [],
        completionPercentage: 0,
      });
      return;
    }

    if (profile) {
      setProfileStatus({
        exists: true,
        hasRoles: (profile.roles || []).length > 0,
        roles: profile.roles || [],
        completionPercentage: profile.profile_completion_percentage || 0,
      });
    } else {
      setProfileStatus({
        exists: false,
        hasRoles: false,
        roles: [],
        completionPercentage: 0,
      });
    }
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center bg-background">
        <span className="text-muted-foreground">Loading…</span>
      </div>
    );
  }

  const hasAccess = hasFeatureAccess(profileStatus, feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showPrompt) {
    return null;
  }

  // Default fallback with prompt
  let message = 'Complete your profile to access this feature';
  if (!profileStatus?.exists) {
    message = 'Create your profile to access this feature';
  } else if (!profileStatus.hasRoles) {
    message = 'Add roles to your profile to access this feature';
  } else if (feature === 'register_for_leg' && !profileStatus.roles.includes('crew')) {
    message = 'Add crew role to your profile to register for legs';
  } else if ((feature === 'create_boat' || feature === 'create_journey') && !profileStatus.roles.includes('owner')) {
    message = 'Add owner role to your profile to create boats and journeys';
  }

  return (
    <div className="p-6">
      <LimitedAccessIndicator message={message} showCompleteProfileCTA={true} />
    </div>
  );
}
