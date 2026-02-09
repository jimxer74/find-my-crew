'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import Link from 'next/link';
import {
  calculateProfileCompletion,
  type ProfileDataForCompletion,
  type ProfileFieldStatus,
} from '@/app/lib/profile/completionCalculator';

type MissingFieldsIndicatorProps = {
  variant?: 'inline' | 'list' | 'compact';
  showTitle?: boolean;
  profileData?: ProfileDataForCompletion | null;
};

export function MissingFieldsIndicator({ 
  variant = 'list',
  showTitle = true,
  profileData = null
}: MissingFieldsIndicatorProps) {
  const { user } = useAuth();
  const [missingFields, setMissingFields] = useState<ProfileFieldStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const computeMissing = useCallback((data: ProfileDataForCompletion) => {
    const result = calculateProfileCompletion(data);
    setMissingFields(result.missingFields);
    setLoading(false);
  }, []);

  const checkMissingFields = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // If profileData is provided as prop, use it directly
    if (profileData) {
      computeMissing(profileData);
      return;
    }

    // Otherwise, fetch from database
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('username, full_name, phone, sailing_experience, risk_level, skills, sailing_preferences, roles')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    computeMissing(data);
  }, [user, profileData, computeMissing]);

  useEffect(() => {
    checkMissingFields();
  }, [checkMissingFields]);

  // Update when profileData prop changes
  useEffect(() => {
    if (profileData) {
      computeMissing(profileData);
    }
  }, [profileData, computeMissing]);

  // Listen for profile updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProfileUpdate = () => {
      // Refresh missing fields when profile is updated
      checkMissingFields();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [checkMissingFields]);

  if (loading) {
    return null;
  }

  if (missingFields.length === 0) {
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
            <Link href="/profile" className="text-primary hover:underline">
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
                    href="/profile"
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
          href="/profile"
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
