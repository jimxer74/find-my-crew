'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { logger } from '@/app/lib/logger';
import { useAuth } from '@/app/contexts/AuthContext';
import { useProfile } from '@/app/lib/profile/useProfile';
import { useUserLocation } from '@/app/hooks/useUserLocation';
import {
  LocationRegion,
  getAllRegions,
  sortRegionsByDistance,
} from '@/app/lib/geocoding/locations';
import { CruisingRegionSection } from '@/app/components/crew/CruisingRegionSection';
import { ProfileCompletionPrompt } from '@/app/components/profile/ProfileCompletionPrompt';
import { Footer } from '@/app/components/Footer';
import { LegRegistrationDialog } from '@/app/components/crew/LegRegistrationDialog';
import { LegListItemData } from '@/app/components/crew/LegListItem';

export default function CrewHomePage() {
  const t = useTranslations('crewHome');
  const tCommon = useTranslations('common');
  const tDashboard = useTranslations('crewDashboard');
  const { user, loading: authLoading } = useAuth();
  const userLocation = useUserLocation();
  const { profile, loading: profileLoading } = useProfile();

  const [sortedRegions, setSortedRegions] = useState<
    Array<LocationRegion & { distance: number }>
  >([]);
  const [visibleRegionsCount, setVisibleRegionsCount] = useState(10);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState<LegListItemData | null>(null);

  // Extract user profile data from useProfile hook
  const userSkills = useMemo(() => {
    if (!profile?.skills) return [];
    const { normalizeSkillNames } = require('@/app/lib/skillUtils');
    return normalizeSkillNames(profile.skills);
  }, [profile?.skills]);

  const userExperienceLevel = useMemo(() => {
    return profile?.sailing_experience || null;
  }, [profile?.sailing_experience]);

  const userRiskLevel = useMemo(() => {
    return profile?.risk_level || null;
  }, [profile?.risk_level]);

  const userDepartureLocation = useMemo(() => {
    return profile?.preferred_departure_location || null;
  }, [profile?.preferred_departure_location]);

  const userArrivalLocation = useMemo(() => {
    return profile?.preferred_arrival_location || null;
  }, [profile?.preferred_arrival_location]);

  // Sort regions by distance based on user's filter settings (departure/arrival location) or browser geolocation
  useEffect(() => {
    // Determine which location to use for sorting:
    // 1. Preferred departure location from profile (highest priority)
    // 2. Preferred arrival location from profile (fallback)
    // 3. Browser geolocation (last resort)
    let sortLat: number | null = null;
    let sortLng: number | null = null;

    if (userDepartureLocation) {
      // Use departure location if available
      if (userDepartureLocation.bbox) {
        // For bbox regions, use center
        const centerLat = (userDepartureLocation.bbox.minLat + userDepartureLocation.bbox.maxLat) / 2;
        const centerLng = (userDepartureLocation.bbox.minLng + userDepartureLocation.bbox.maxLng) / 2;
        sortLat = centerLat;
        sortLng = centerLng;
      } else if (userDepartureLocation.lat && userDepartureLocation.lng) {
        sortLat = userDepartureLocation.lat;
        sortLng = userDepartureLocation.lng;
      }
    } else if (userArrivalLocation) {
      // Fallback to arrival location
      if (userArrivalLocation.bbox) {
        const centerLat = (userArrivalLocation.bbox.minLat + userArrivalLocation.bbox.maxLat) / 2;
        const centerLng = (userArrivalLocation.bbox.minLng + userArrivalLocation.bbox.maxLng) / 2;
        sortLat = centerLat;
        sortLng = centerLng;
      } else if (userArrivalLocation.lat && userArrivalLocation.lng) {
        sortLat = userArrivalLocation.lat;
        sortLng = userArrivalLocation.lng;
      }
    } else if (!userLocation.loading && userLocation.lat && userLocation.lng) {
      // Last resort: browser geolocation
      sortLat = userLocation.lat;
      sortLng = userLocation.lng;
    }

    if (sortLat !== null && sortLng !== null) {
      const regions = getAllRegions();
      const sorted = sortRegionsByDistance(sortLat, sortLng, regions);
      setSortedRegions(sorted);
    } else if (!userLocation.loading && !user) {
      // For non-authenticated users without geolocation, show regions in default order
      const regions = getAllRegions();
      setSortedRegions(regions.map(r => ({ ...r, distance: 0 })));
    }
  }, [userLocation.loading, userLocation.lat, userLocation.lng, userDepartureLocation, userArrivalLocation, user]);

  // Handle Join button click - open registration dialog
  const handleJoinClick = useCallback((leg: LegListItemData) => {
    setSelectedLeg(leg);
    setRegistrationDialogOpen(true);
  }, []);

  // Loading state
  if (authLoading || userLocation.loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {userLocation.loading || profileLoading ? t('detectingLocation') : tCommon('loading')}
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
        {/* Regions List */}
        <div>
          {sortedRegions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">{tCommon('loading')}</p>
            </div>
          ) : (
            <>
              {sortedRegions.slice(0, visibleRegionsCount).map((region, index) => (
                <CruisingRegionSection
                  key={`${region.name}-${region.bbox.minLng}-${region.bbox.minLat}-${region.bbox.maxLng}-${region.bbox.maxLat}-${index}`}
                  region={region}
                  userSkills={userSkills}
                  userExperienceLevel={userExperienceLevel}
                  userRiskLevel={userRiskLevel}
                  userDepartureLocation={userDepartureLocation}
                  userArrivalLocation={userArrivalLocation}
                  onJoinClick={handleJoinClick}
                />
              ))}

              {/* Show More Button */}
              {visibleRegionsCount < sortedRegions.length && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => setVisibleRegionsCount((prev) => prev + 10)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    {t('loadMore')}
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
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Registration Dialog */}
      <LegRegistrationDialog
        isOpen={registrationDialogOpen}
        onClose={() => {
          setRegistrationDialogOpen(false);
          setSelectedLeg(null);
        }}
        leg={selectedLeg ? {
          leg_id: selectedLeg.leg_id,
          journey_id: selectedLeg.journey_id || '',
          leg_name: selectedLeg.leg_name,
          journey_name: selectedLeg.journey_name || '',
        } : null}
        onSuccess={() => {
          // Registration successful - could refresh data or show success message
          logger.debug('Registration successful!');
        }}
      />
    </div>
  );
}
