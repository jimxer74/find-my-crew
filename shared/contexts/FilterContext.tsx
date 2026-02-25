'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { DateRange } from '@shared/ui/DateRangePicker';
import { Location } from '@shared/ui/LocationAutocomplete';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { useAuth } from '@/app/contexts/AuthContext';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type FilterState = {
  dateRange: DateRange;
  location: Location | null;
  locationInput: string;
  arrivalLocation: Location | null;
  arrivalLocationInput: string;
  experienceLevel: ExperienceLevel | null;
  riskLevel: RiskLevel[];
};

type FilterContextType = {
  filters: FilterState;
  updateFilters: (updates: Partial<FilterState>) => void;
  clearFilters: () => void;
  lastUpdated: number; // Timestamp of last filter update to trigger reloads
};

const defaultFilters: FilterState = {
  dateRange: { start: null, end: null },
  location: null,
  locationInput: '',
  arrivalLocation: null,
  arrivalLocationInput: '',
  experienceLevel: null,
  riskLevel: [],
};

const FilterContext = createContext<FilterContextType>({
  filters: defaultFilters,
  updateFilters: () => {},
  clearFilters: () => {},
  lastUpdated: Date.now(),
});

export function FilterProvider({ children }: { children: ReactNode }) {
  logger.debug('[FilterProvider] COMPONENT_BODY START');
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  logger.debug('[FilterProvider] STATE_DECLARED', { isInitialized, userFromAuth: !!user, authLoading });
  logger.info('[FilterProvider] Rendering', { isInitialized });

  // Load filters from session storage on mount
  useEffect(() => {
    logger.debug('[CRITICAL] FilterProvider mount effect EXECUTED');
    logger.debug('[FALLBACK] FilterProvider mount effect running');
    logger.info('[FilterProvider] Mount effect running', {});
    if (typeof window === 'undefined') {
      logger.info('[FilterProvider] SSR environment, skipping', {});
      return;
    }

    try {
      logger.info('[FilterProvider] Loading filters from session storage', {});
      // Load date range
      const dateRangeStored = sessionStorage.getItem('crew-date-range');
      let dateRange = defaultFilters.dateRange;
      if (dateRangeStored) {
        const parsed = JSON.parse(dateRangeStored);
        dateRange = {
          start: parsed.start ? new Date(parsed.start) : null,
          end: parsed.end ? new Date(parsed.end) : null,
        };
      }

      // Load other filters
      const filtersStored = sessionStorage.getItem('crew-filters');
      let otherFilters = {
        location: null as Location | null,
        locationInput: '',
        arrivalLocation: null as Location | null,
        arrivalLocationInput: '',
        experienceLevel: null as ExperienceLevel | null,
        riskLevel: [] as RiskLevel[],
      };

      if (filtersStored) {
        const parsed = JSON.parse(filtersStored);
        if (parsed.location) {
          otherFilters.location = parsed.location as Location;
          otherFilters.locationInput = parsed.locationInput || '';
        }
        if (parsed.arrivalLocation) {
          otherFilters.arrivalLocation = parsed.arrivalLocation as Location;
          otherFilters.arrivalLocationInput = parsed.arrivalLocationInput || '';
        }
        if (parsed.experienceLevel !== undefined) {
          otherFilters.experienceLevel = parsed.experienceLevel as ExperienceLevel | null;
        }
        if (parsed.riskLevel) {
          otherFilters.riskLevel = parsed.riskLevel as RiskLevel[];
        }
      }

      setFilters({
        dateRange,
        ...otherFilters,
      });
      logger.info('[FilterProvider] Loaded from session storage, setting isInitialized=true', {});
    } catch (err) {
      logger.error('[FilterProvider] Error loading filters from session', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Load profile preferences as filter defaults when user logs in
  // This effect loads from profile on every initialization to ensure fresh data
  useEffect(() => {
    logger.debug('[FALLBACK] FilterProvider profile load effect running', { isInitialized, userFromAuth: !!user, authLoading });
    logger.info('[FilterProvider] Profile load effect running', { isInitialized, hasUser: !!user, authLoading });
    if (!isInitialized) {
      logger.info('[FilterProvider] Not initialized yet, skipping profile load', {});
      return;
    }
    if (authLoading) {
      logger.info('[FilterProvider] Auth still loading, skipping profile load for now', {});
      return;
    }
    if (!user) {
      logger.info('[FilterProvider] No authenticated user, skipping profile load', {});
      return;
    }
    if (typeof window === 'undefined') {
      logger.info('[FilterProvider] SSR environment, skipping profile load', {});
      return;
    }
    logger.info('[FilterProvider] About to load profile preferences', { userId: user.id });

    const loadProfilePreferences = async () => {
      try {
        logger.debug('[FALLBACK] loadProfilePreferences called');
        const supabase = getSupabaseBrowserClient();
        logger.debug('[FALLBACK] User from AuthContext:', { userId: user.id });
        logger.info('[FilterContext] Loading profile preferences', { userId: user.id });
        if (!user) {
          logger.info('[FilterContext] No user found, skipping profile load', {});
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('preferred_departure_location, preferred_arrival_location, availability_start_date, availability_end_date, sailing_experience, risk_level')
          .eq('id', user.id)
          .single();

        logger.info('[FilterContext] Profile fetch result', { hasProfile: !!profile, hasError: !!error, errorCode: (error as any)?.code });

        if (error) {
          // PGRST116 is "no rows found" - this is expected during onboarding when profile doesn't exist yet
          if ((error as any)?.code === 'PGRST116') {
            logger.info('[FilterContext] No profile found (expected during onboarding)', {});
          } else {
            logger.error('[FilterContext] Error fetching profile for filter defaults', { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }

        if (!profile) {
          logger.info('[FilterContext] No profile data found', {});
          return;
        }

        logger.info('[FilterContext] Profile data loaded', {
          hasDeparture: !!profile.preferred_departure_location,
          hasArrival: !!profile.preferred_arrival_location,
          hasStartDate: !!profile.availability_start_date,
          hasEndDate: !!profile.availability_end_date,
          experience: profile.sailing_experience,
          hasRiskLevel: !!profile.risk_level,
        });

        const updates: Partial<FilterState> = {};

        // Pre-select departure location from profile
        if (profile.preferred_departure_location) {
          const loc = profile.preferred_departure_location as Location;
          updates.location = loc;
          updates.locationInput = loc.name;
          logger.info('[FilterContext] Setting departure location', { name: loc.name });
        }

        // Pre-select arrival location from profile
        if (profile.preferred_arrival_location) {
          const loc = profile.preferred_arrival_location as Location;
          updates.arrivalLocation = loc;
          updates.arrivalLocationInput = loc.name;
          logger.info('[FilterContext] Setting arrival location', { name: loc.name });
        }

        // Pre-select date range from profile
        if (profile.availability_start_date || profile.availability_end_date) {
          updates.dateRange = {
            start: profile.availability_start_date ? new Date(profile.availability_start_date + 'T00:00:00') : null,
            end: profile.availability_end_date ? new Date(profile.availability_end_date + 'T00:00:00') : null,
          };
          logger.info('[FilterContext] Setting date range', { startDate: updates.dateRange.start, endDate: updates.dateRange.end });
        }

        // Pre-select experience level from profile
        if (profile.sailing_experience !== null && profile.sailing_experience !== undefined) {
          updates.experienceLevel = profile.sailing_experience as ExperienceLevel;
          logger.info('[FilterContext] Setting experience level', { experience_level: profile.sailing_experience });
        }

        // Pre-select risk level from profile
        if (profile.risk_level && Array.isArray(profile.risk_level) && profile.risk_level.length > 0) {
          updates.riskLevel = profile.risk_level as RiskLevel[];
          logger.info('[FilterContext] Setting risk level', { risk_level: profile.risk_level });
        }

        // Apply updates if there are any profile preferences to load
        if (Object.keys(updates).length > 0) {
          logger.info('[FilterContext] Applying filter updates from profile', { updateKeys: Object.keys(updates), updateCount: Object.keys(updates).length });
          setFilters(prev => ({ ...prev, ...updates }));
          setLastUpdated(Date.now());
        } else {
          logger.info('[FilterContext] No profile preferences found to apply', {});
        }
      } catch (err) {
        logger.error('[FilterContext] Error loading profile preferences as filter defaults', { error: err instanceof Error ? err.message : String(err) });
      }
    };

    loadProfilePreferences();
  }, [isInitialized, user, authLoading]); // Re-run when auth status changes

  // Save to session storage whenever filters change (after initialization)
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    try {
      // Save date range separately
      const dateRangeSerialized = {
        start: filters.dateRange.start ? filters.dateRange.start.toISOString() : null,
        end: filters.dateRange.end ? filters.dateRange.end.toISOString() : null,
      };
      sessionStorage.setItem('crew-date-range', JSON.stringify(dateRangeSerialized));

      // Save other filters
      const filtersSerialized = {
        location: filters.location,
        locationInput: filters.locationInput,
        arrivalLocation: filters.arrivalLocation,
        arrivalLocationInput: filters.arrivalLocationInput,
        experienceLevel: filters.experienceLevel,
        riskLevel: filters.riskLevel,
      };
      sessionStorage.setItem('crew-filters', JSON.stringify(filtersSerialized));
    } catch (err) {
      logger.error('Error saving filters to session', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [filters, isInitialized]);

  // Clear filters on logout
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supabase = getSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Clear filters from state
        setFilters(defaultFilters);
        setLastUpdated(Date.now());

        // Clear filters from session storage
        try {
          sessionStorage.removeItem('crew-date-range');
          sessionStorage.removeItem('crew-filters');
        } catch (err) {
          logger.error('Error clearing filters from session on logout', { error: err instanceof Error ? err.message : String(err) });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    setLastUpdated(Date.now()); // Update timestamp to trigger reloads
    // Clear the "filters cleared" flag when user updates filters (allows profile loading again on next empty state)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('crew-filters-cleared');
      } catch (err) {
        // Ignore errors
      }
    }
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setLastUpdated(Date.now()); // Update timestamp to trigger reloads
    // Mark that filters were explicitly cleared (prevent auto-loading from profile)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('crew-filters-cleared', 'true');
        // Also clear session storage for filters
        sessionStorage.removeItem('crew-date-range');
        sessionStorage.removeItem('crew-filters');
      } catch (err) {
        logger.error('Error marking filters as cleared', { error: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilters, clearFilters, lastUpdated }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
