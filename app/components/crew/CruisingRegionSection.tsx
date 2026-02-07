'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LocationRegion } from '@/app/lib/geocoding/locations';
import { LegCarousel } from './LegCarousel';
import { LegListItemData } from './LegListItem';

type CruisingRegionSectionProps = {
  region: LocationRegion;
  userSkills?: string[];
  userExperienceLevel?: number | null;
};

export function CruisingRegionSection({
  region,
  userSkills = [],
  userExperienceLevel = null,
}: CruisingRegionSectionProps) {
  const router = useRouter();
  const [legs, setLegs] = useState<LegListItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLegs();
  }, [region]);

  const fetchLegs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        min_lng: region.bbox.minLng.toString(),
        min_lat: region.bbox.minLat.toString(),
        max_lng: region.bbox.maxLng.toString(),
        max_lat: region.bbox.maxLat.toString(),
        limit: '10',
      });

      const response = await fetch(`/api/legs/by-region?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch legs');
      }

      const data = await response.json();

      // Calculate match scores for each leg
      const legsWithScores = (data.legs || []).map((leg: any) => {
        const matchPercentage = calculateSkillMatch(leg.skills || [], userSkills);
        const experienceMatches = userExperienceLevel
          ? userExperienceLevel >= (leg.min_experience_level || 1)
          : true;

        return {
          ...leg,
          skill_match_percentage: matchPercentage,
          experience_level_matches: experienceMatches,
        };
      });

      // Sort by match percentage (best matches first)
      legsWithScores.sort((a: any, b: any) => {
        const aScore = a.skill_match_percentage || 0;
        const bScore = b.skill_match_percentage || 0;
        return bScore - aScore;
      });

      setLegs(legsWithScores);
    } catch (err) {
      console.error('Error fetching legs for region:', region.name, err);
      setError('Failed to load legs');
    } finally {
      setLoading(false);
    }
  };

  // Calculate skill match percentage
  const calculateSkillMatch = (legSkills: string[], userSkills: string[]): number => {
    if (!legSkills || legSkills.length === 0) return 100; // No skills required = 100% match
    if (!userSkills || userSkills.length === 0) return 0; // User has no skills = 0% match

    const normalizedLegSkills = legSkills.map((s) => s.toLowerCase().trim());
    const normalizedUserSkills = userSkills.map((s) => s.toLowerCase().trim());

    const matchingSkills = normalizedLegSkills.filter((skill) =>
      normalizedUserSkills.includes(skill)
    );

    return Math.round((matchingSkills.length / normalizedLegSkills.length) * 100);
  };

  // Handle leg click - navigate to dashboard with leg selected
  const handleLegClick = (leg: LegListItemData) => {
    router.push(`/crew/dashboard?legId=${leg.leg_id}`);
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
        <Link
          href={getMapUrl()}
          className="group flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">
            {region.name}
          </h2>
          <svg
            className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
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
        loading={loading}
      />
    </section>
  );
}
