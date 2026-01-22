'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import Link from 'next/link';

type MissingFieldsIndicatorProps = {
  variant?: 'inline' | 'list' | 'compact';
  showTitle?: boolean;
  profileData?: {
    username: string | null;
    full_name: string | null;
    phone: string | null;
    sailing_experience: any;
    risk_level: any[] | null;
    skills: any[] | null;
    sailing_preferences: string | null;
    roles: string[] | null;
  } | null;
};

type FieldStatus = {
  name: string;
  label: string;
  missing: boolean;
  section?: string;
};

export function MissingFieldsIndicator({ 
  variant = 'list',
  showTitle = true,
  profileData = null
}: MissingFieldsIndicatorProps) {
  const { user } = useAuth();
  const [missingFields, setMissingFields] = useState<FieldStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const calculateMissingFields = useCallback((data: {
    username: string | null;
    full_name: string | null;
    phone: string | null;
    sailing_experience: any;
    risk_level: any[] | null;
    skills: any[] | null;
    sailing_preferences: string | null;
    roles: string[] | null;
  }) => {
    const fields: FieldStatus[] = [
      {
        name: 'username',
        label: 'Username',
        missing: !data.username || data.username.trim() === '',
        section: 'Basic Information',
      },
      {
        name: 'full_name',
        label: 'Full Name',
        missing: !data.full_name || data.full_name.trim() === '',
        section: 'Basic Information',
      },
      {
        name: 'phone',
        label: 'Phone Number',
        missing: !data.phone || data.phone.trim() === '',
        section: 'Basic Information',
      },
      {
        name: 'sailing_experience',
        label: 'Sailing Experience Level',
        missing: data.sailing_experience === null || data.sailing_experience === undefined,
        section: 'Experience',
      },
      {
        name: 'risk_level',
        label: 'Risk Level Preferences',
        missing: !data.risk_level || !Array.isArray(data.risk_level) || data.risk_level.length === 0,
        section: 'Experience',
      },
      {
        name: 'skills',
        label: 'Skills',
        missing: !data.skills || !Array.isArray(data.skills) || data.skills.length === 0,
        section: 'Skills',
      },
      {
        name: 'sailing_preferences',
        label: 'Sailing Preferences',
        missing: !data.sailing_preferences || data.sailing_preferences.trim() === '',
        section: 'Preferences',
      },
      {
        name: 'roles',
        label: 'Roles (Owner/Crew)',
        missing: !data.roles || !Array.isArray(data.roles) || data.roles.length === 0,
        section: 'Roles',
      },
    ];

    setMissingFields(fields.filter(f => f.missing));
    setLoading(false);
  }, []);

  const checkMissingFields = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // If profileData is provided as prop, use it directly
    if (profileData) {
      calculateMissingFields(profileData);
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

    calculateMissingFields(data);
  }, [user, profileData, calculateMissingFields]);

  useEffect(() => {
    checkMissingFields();
  }, [checkMissingFields]);

  // Update when profileData prop changes
  useEffect(() => {
    if (profileData) {
      calculateMissingFields(profileData);
    }
  }, [profileData, calculateMissingFields]);

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
  }, {} as Record<string, FieldStatus[]>);

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
