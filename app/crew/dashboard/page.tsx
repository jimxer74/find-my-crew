'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
import { CrewBrowseMap } from '@/app/components/crew/CrewBrowseMap';
import { Location } from '@shared/ui/LocationAutocomplete';

export default function CrewDashboard() {
  const t = useTranslations('crewDashboard');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const { updateFilters } = useFilters();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLegId = searchParams.get('legId');
  const openRegistration = searchParams.get('register') === 'true';
  const fromParam = searchParams.get('from');
  const fromAssistant = fromParam === 'assistant';
  const fromProspect = fromParam === 'prospect';
  const hasAppliedUrlFiltersRef = useRef(false);
  const [showBackButton, setShowBackButton] = useState(fromAssistant || fromProspect);

  // Parse region bbox from URL params
  const initialRegionBbox = useMemo(() => {
    const regionName = searchParams.get('region');
    const minLng = searchParams.get('departure_min_lng');
    const minLat = searchParams.get('departure_min_lat');
    const maxLng = searchParams.get('departure_max_lng');
    const maxLat = searchParams.get('departure_max_lat');

    if (regionName && minLng && minLat && maxLng && maxLat) {
      return {
        name: regionName,
        bbox: {
          minLng: parseFloat(minLng),
          minLat: parseFloat(minLat),
          maxLng: parseFloat(maxLng),
          maxLat: parseFloat(maxLat),
        },
      };
    }
    return null;
  }, [searchParams]);

  // Apply region filter from URL params (only once on mount)
  useEffect(() => {
    if (initialRegionBbox && !hasAppliedUrlFiltersRef.current) {
      hasAppliedUrlFiltersRef.current = true;

      const centerLat = (initialRegionBbox.bbox.minLat + initialRegionBbox.bbox.maxLat) / 2;
      const centerLng = (initialRegionBbox.bbox.minLng + initialRegionBbox.bbox.maxLng) / 2;

      const location: Location = {
        name: initialRegionBbox.name,
        lat: centerLat,
        lng: centerLng,
        isCruisingRegion: true,
        bbox: initialRegionBbox.bbox,
      };

      updateFilters({
        location,
        locationInput: initialRegionBbox.name,
      });
    }
  }, [initialRegionBbox]); // eslint-disable-line react-hooks/exhaustive-deps

  // Allow non-signed-in users to browse journeys with limited information
  // No redirect to login - they can browse but will see limited details

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <div className="bg-background flex flex-col overflow-hidden fixed inset-0 h-screen w-screen">

      {/* "Back to Assistant" button - shown at top-left when navigated from prospect chat or assistant */}
      {showBackButton && (
        <div className="fixed top-16 left-0 z-50 px-4 py-2 md:hidden">
          <button
            onClick={() => router.push('/welcome/crew')}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md shadow-md hover:bg-accent transition-all min-h-[44px]"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="font-medium text-sm text-foreground">
              Back to Assistant
            </span>
          </button>
        </div>
      )}

      {/* List View button - Mobile view top left (only show if Back to Assistant is not shown) */}
      {!showBackButton && (
        <div className="fixed top-0 left-0 z-[120] px-4 py-2 md:hidden">
          <button
            onClick={() => router.push('/crew')}
            className="flex items-center gap-2 px-3 py-2 border border-border bg-background hover:bg-accent rounded-md transition-all min-h-[44px]"
            title="List View"
            aria-label="List View"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
            <span className="font-medium text-sm text-foreground">
              List View
            </span>
          </button>
        </div>
      )}

      <main className="flex-1 relative overflow-hidden w-full h-full" style={{ minHeight: 0 }}>
        <CrewBrowseMap
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          initialLegId={initialLegId}
          initialOpenRegistration={openRegistration}
          initialBounds={initialRegionBbox?.bbox}
        />

      </main>

    </div>
  );
}
