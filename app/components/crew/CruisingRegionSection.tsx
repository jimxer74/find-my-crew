'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { LocationRegion } from '@/app/lib/geocoding/locations';
import { LegCarousel } from './LegCarousel';
import { LegListItemData } from './LegListItem';
import { calculateMatchPercentage } from '@/app/lib/skillMatching';

type CruisingRegionSectionProps = {
  region: LocationRegion;
  userSkills?: string[];
  userExperienceLevel?: number | null;
  userRiskLevel?: string[] | null;
  onJoinClick?: (leg: LegListItemData) => void;
};

export function CruisingRegionSection({
  region,
  userSkills = [],
  userExperienceLevel = null,
  userRiskLevel = null,
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

      // Sort by match percentage only when user is authenticated
      if (user) {
        legsWithScores.sort((a: any, b: any) => {
          const aScore = a.skill_match_percentage || 0;
          const bScore = b.skill_match_percentage || 0;
          return bScore - aScore;
        });
      }

      setLegs(legsWithScores);
    } catch (err) {
      console.error('Error fetching legs for region:', region.name, err);
      setError('Failed to load legs');
    } finally {
      setLoading(false);
    }
  }, [region, user, userSkills, userExperienceLevel, userRiskLevel]);

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
      <div className="flex items-center justify-between mb-3">
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
