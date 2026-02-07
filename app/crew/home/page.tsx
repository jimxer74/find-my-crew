'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useUserLocation } from '@/app/hooks/useUserLocation';
import {
  LocationRegion,
  getAllRegions,
  sortRegionsByDistance,
} from '@/app/lib/geocoding/locations';
import { CruisingRegionSection } from '@/app/components/crew/CruisingRegionSection';
import { ProfileCompletionPrompt } from '@/app/components/profile/ProfileCompletionPrompt';

export default function CrewHomePage() {
  const t = useTranslations('crewHome');
  const tCommon = useTranslations('common');
  const tDashboard = useTranslations('crewDashboard');
  const { user, loading: authLoading } = useAuth();
  const userLocation = useUserLocation();

  const [sortedRegions, setSortedRegions] = useState<
    Array<LocationRegion & { distance: number }>
  >([]);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [userExperienceLevel, setUserExperienceLevel] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Sort regions by distance when user location is available
  useEffect(() => {
    if (!userLocation.loading && userLocation.lat && userLocation.lng) {
      const regions = getAllRegions();
      const sorted = sortRegionsByDistance(userLocation.lat, userLocation.lng, regions);
      setSortedRegions(sorted);
    }
  }, [userLocation.loading, userLocation.lat, userLocation.lng]);

  // Load user profile (skills and experience level)
  useEffect(() => {
    if (!user) {
      setUserSkills([]);
      setUserExperienceLevel(null);
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('skills, sailing_experience')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setUserSkills(data.skills || []);
        setUserExperienceLevel(data.sailing_experience || null);
      }
      setProfileLoading(false);
    };

    loadProfile();
  }, [user]);

  // Loading state
  if (authLoading || userLocation.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {userLocation.loading ? t('detectingLocation') : tCommon('loading')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Profile Completion Prompt */}
      {user && <ProfileCompletionPrompt variant="banner" showCompletionPercentage={true} />}

      {/* Sign-in Banner for non-authenticated users */}
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
              <p className="text-sm text-foreground font-medium">
                {tDashboard('signInBanner')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/auth/login"
                className="text-sm text-primary hover:underline font-medium px-3 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
              >
                {tDashboard('signIn')}
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                {tDashboard('signUp')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-2 pb-4">
        {/* Regions List with View on Map button positioned on first row */}
        <div className="relative">
          {/* View on Map button - absolutely positioned to align with first region header */}
          <Link
            href="/crew/dashboard"
            className="absolute top-0 right-0 z-10 flex items-center gap-2 px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            {t('viewOnMap')}
          </Link>

          {sortedRegions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">{tCommon('loading')}</p>
            </div>
          ) : (
            sortedRegions.map((region) => (
              <CruisingRegionSection
                key={region.name}
                region={region}
                userSkills={userSkills}
                userExperienceLevel={userExperienceLevel}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
