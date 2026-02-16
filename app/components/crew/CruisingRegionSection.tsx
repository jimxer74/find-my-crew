'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { LocationRegion } from '@/app/lib/geocoding/locations';
import { LegCarousel } from './LegCarousel';
import { LegListItemData } from './LegListItem';
import { calculateMatchPercentage } from '@/app/lib/skillMatching';
import { ProfileLocation } from '@/app/lib/profile/useProfile';

type CruisingRegionSectionProps = {
  region: LocationRegion;
  userSkills?: string[];
  userExperienceLevel?: number | null;
  userRiskLevel?: string[] | null;
  userDepartureLocation?: ProfileLocation | null;
  userArrivalLocation?: ProfileLocation | null;
  onJoinClick?: (leg: LegListItemData) => void;
};

// Haversine distance in km between two coordinates
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate proximity score (0-100) based on distance or bbox containment
function proximityScore(
  waypointLat: number | undefined,
  waypointLng: number | undefined,
  userLocation: ProfileLocation | null | undefined
): number {
  if (!userLocation || waypointLat == null || waypointLng == null) return 50; // neutral score

  // If user selected a cruising region with bbox, check containment
  if (userLocation.bbox) {
    const { minLng, minLat, maxLng, maxLat } = userLocation.bbox;
    if (
      waypointLng >= minLng && waypointLng <= maxLng &&
      waypointLat >= minLat && waypointLat <= maxLat
    ) {
      return 100; // inside preferred region
    }
    // Outside bbox: score based on distance to bbox center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const dist = haversineDistance(waypointLat, waypointLng, centerLat, centerLng);
    return Math.max(0, 100 - (dist / 50)); // decay over ~5000km
  }

  // Point-to-point distance
  const dist = haversineDistance(waypointLat, waypointLng, userLocation.lat, userLocation.lng);
  return Math.max(0, 100 - (dist / 50)); // decay over ~5000km
}

export function CruisingRegionSection({
  region,
  userSkills = [],
  userExperienceLevel = null,
  userRiskLevel = null,
  userDepartureLocation = null,
  userArrivalLocation = null,
  onJoinClick,
}: CruisingRegionSectionProps) {
  const t = useTranslations('crewHome');
  const router = useRouter();
  const { user } = useAuth();
  const [legs, setLegs] = useState<LegListItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLegs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        min_lng: region.bbox.minLng.toString(),
        min_lat: region.bbox.minLat.toString(),
        max_lng: region.bbox.maxLng.toString(),
        max_lat: region.bbox.maxLat.toString(),
        limit: '20',
      });

      const response = await fetch(`/api/legs/by-region?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch legs');
      }

      const data = await response.json();
      const rawLegs = data.legs || [];

      // Only calculate and attach match scores when user is authenticated
      const legsWithScores = user
        ? rawLegs.map((leg: any) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('[CruisingRegionSection] Calculating match for leg:', {
                leg_id: leg.leg_id || leg.id,
                leg_name: leg.leg_name || leg.name,
                leg_skills: leg.skills || [],
                user_skills: userSkills,
              });
            }
            const matchPercentage = calculateMatchPercentage(
              userSkills,
              leg.skills || [],
              userRiskLevel,
              leg.leg_risk_level || leg.risk_level || null,
              leg.journey_risk_level || null,
              userExperienceLevel,
              leg.min_experience_level || null
            );
            const experienceMatches = userExperienceLevel
              ? userExperienceLevel >= (leg.min_experience_level || 1)
              : true;
            return {
              ...leg,
              skill_match_percentage: matchPercentage,
              experience_level_matches: experienceMatches,
            };
          })
        : rawLegs;

      // Sort by multi-factor score when user is authenticated
      if (user) {
        const hasLocationPrefs = !!(userDepartureLocation || userArrivalLocation);
        legsWithScores.sort((a: any, b: any) => {
          const aSkill = a.skill_match_percentage || 0;
          const bSkill = b.skill_match_percentage || 0;

          if (!hasLocationPrefs) {
            return bSkill - aSkill;
          }

          // Multi-factor: skill 50% + departure proximity 25% + arrival proximity 25%
          const aDepProx = proximityScore(a.start_waypoint?.lat, a.start_waypoint?.lng, userDepartureLocation);
          const bDepProx = proximityScore(b.start_waypoint?.lat, b.start_waypoint?.lng, userDepartureLocation);
          const aArrProx = proximityScore(a.end_waypoint?.lat, a.end_waypoint?.lng, userArrivalLocation);
          const bArrProx = proximityScore(b.end_waypoint?.lat, b.end_waypoint?.lng, userArrivalLocation);

          const aTotal = aSkill * 0.5 + aDepProx * 0.25 + aArrProx * 0.25;
          const bTotal = bSkill * 0.5 + bDepProx * 0.25 + bArrProx * 0.25;
          return bTotal - aTotal;
        });
      }

      setLegs(legsWithScores);
    } catch (err) {
      console.error('Error fetching legs for region:', region.name, err);
      setError('Failed to load legs');
    } finally {
      setLoading(false);
    }
  }, [region, user, userSkills, userExperienceLevel, userRiskLevel, userDepartureLocation, userArrivalLocation]);

  useEffect(() => {
    fetchLegs();
  }, [fetchLegs]);

  // Handle leg click - navigate to dashboard with leg selected
  const handleLegClick = (leg: LegListItemData) => {
    router.push(`/crew/dashboard?legId=${leg.leg_id}`);
  };

  // Handle Join - use provided handler or default to navigation
  const handleJoinClickInternal = (leg: LegListItemData) => {
    if (onJoinClick) {
      onJoinClick(leg);
    } else {
      // Fallback to navigation if no handler provided
      router.push(`/crew/dashboard?legId=${leg.leg_id}&register=true`);
    }
  };

  // Build URL for "View on Map" link
  const getMapUrl = () => {
    const params = new URLSearchParams({
      region: region.name,
      departure_min_lng: region.bbox.minLng.toString(),
      departure_min_lat: region.bbox.minLat.toString(),
      departure_max_lng: region.bbox.maxLng.toString(),
      departure_max_lat: region.bbox.maxLat.toString(),
    });
    return `/crew/dashboard?${params}`;
  };

  // Don't render if no legs and not loading
  if (!loading && legs.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      {/* Region Header */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">
          {region.name}
        </h2>
        <button
          onClick={() => router.push(getMapUrl())}
          className="flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          title={t('viewOnMap')}
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
          <span className="hidden sm:inline">{t('viewOnMap')}</span>
        </button>
      </div>

      {/* Region Description (optional) */}
      {region.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
          {region.description}
        </p>
      )}

      {/* Error State */}
      {error && (
        <div className="text-sm text-destructive py-4">
          {error}
        </div>
      )}

      {/* Legs Carousel */}
      <LegCarousel
        legs={legs}
        onLegClick={handleLegClick}
        onJoinClick={user ? handleJoinClickInternal : undefined}
        loading={loading}
        showMoreUrl={getMapUrl()}
        showMatchBadge={!!user}
      />
    </section>
  );
}
