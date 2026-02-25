'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  calculateProfileCompletion,
  type ProfileDataForCompletion,
  type ProfileFieldStatus,
} from '@shared/lib/profile/completionCalculator';
import { useProfileRedirect } from '@shared/lib/profile/redirectHelper';
import { useProfile } from '@shared/lib/profile/useProfile';

type MissingFieldsIndicatorProps = {
  variant?: 'inline' | 'list' | 'compact';
  showTitle?: boolean;
  profileData?: ProfileDataForCompletion | null;
  handleRedirect?: (e: React.MouseEvent) => void;
};

export function MissingFieldsIndicator({
  variant = 'list',
  showTitle = true,
  profileData = null,
  handleRedirect: customHandleRedirect
}: MissingFieldsIndicatorProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { handleRedirect } = useProfileRedirect();
  const { profile, loading } = useProfile();
  const [missingFields, setMissingFields] = useState<ProfileFieldStatus[]>([]);

  const handleProfileClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (customHandleRedirect) {
      customHandleRedirect(e);
    } else if (user) {
      await handleRedirect(user.id, router);
    }
  };

  const computeMissing = useCallback((data: ProfileDataForCompletion) => {
    const result = calculateProfileCompletion(data);
    setMissingFields(result.missingFields);
  }, []);

  // Use profile data from the shared hook or prop
  useEffect(() => {
    if (profileData) {
      // Use prop data if provided
      computeMissing(profileData);
    } else if (profile) {
      // Use shared hook data - convert to compatible format
      const compatibleProfile = {
        username: profile.username,
        full_name: profile.full_name,
        phone: profile.phone,
        sailing_experience: profile.sailing_experience,
        // Convert string to array if needed
        risk_level: profile.risk_level ? (Array.isArray(profile.risk_level) ? profile.risk_level : [profile.risk_level]) : null,
        // Convert string array to unknown array
        skills: profile.skills as unknown[],
        sailing_preferences: profile.sailing_preferences ? profile.sailing_preferences.join(', ') : null,
        roles: profile.roles,
      };
      computeMissing(compatibleProfile);
    } else {
      // No profile data available
      setMissingFields([]);
    }
  }, [profile, profileData, computeMissing]);

  // Listen for profile updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProfileUpdate = () => {
      // Refresh missing fields when profile is updated
      // The useProfile hook will automatically update profile state
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  if (loading) {
    return null;
  }

  if (missingFields.length === 0 && !profileData) {
    return null; // Profile is complete
  }

  if (variant === 'compact') {
    return (
      <div className="text-xs text-muted-foreground">
        Missing: {missingFields.map(f => f.label).join(', ')}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="text-sm text-muted-foreground">
        {showTitle && <span className="font-medium">Missing: </span>}
        {missingFields.map((field, index) => (
          <span key={field.name}>
            {index > 0 && ', '}
            <Link href="#" onClick={handleProfileClick} className="text-primary hover:underline">
              {field.label}
            </Link>
          </span>
        ))}
      </div>
    );
  }

  // list variant (default)
  const fieldsBySection = missingFields.reduce((acc, field) => {
    const section = field.section || 'Other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, ProfileFieldStatus[]>);

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4">
      {showTitle && (
        <h4 className="text-sm font-semibold text-foreground mb-3">
          Complete your profile by adding:
        </h4>
      )}
      <div className="space-y-3">
        {Object.entries(fieldsBySection).map(([section, fields]) => (
          <div key={section}>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              {section}
            </div>
            <ul className="space-y-1.5">
              {fields.map((field) => (
                <li key={field.name} className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <Link
                    href="#"
                    onClick={handleProfileClick}
                    className="text-sm text-foreground hover:text-primary transition-colors"
                  >
                    {field.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border">
        <Link
          href="#"
          onClick={handleProfileClick}
          className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
        >
          Complete your profile
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
