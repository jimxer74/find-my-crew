'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { DateRange } from '@/app/components/ui/DateRangePicker';
import { Location } from '@/app/components/ui/LocationAutocomplete';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

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
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Load filters from session storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
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
    } catch (err) {
      console.error('Error loading filters from session:', err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Load profile preferences as filter defaults when user logs in
  // Only load from profile if filters are empty AND user hasn't explicitly cleared them
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window === 'undefined') return;

    // Check if user explicitly cleared filters (don't reload from profile)
    const filtersCleared = sessionStorage.getItem('crew-filters-cleared') === 'true';
    if (filtersCleared) return;

    // Only load from profile if all filters are empty (first time or after session cleared)
    const hasAnyFilters =
      filters.location !== null ||
      filters.arrivalLocation !== null ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.experienceLevel !== null ||
      filters.riskLevel.length > 0;

    if (hasAnyFilters) return;

    const loadProfilePreferences = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_departure_location, preferred_arrival_location, availability_start_date, availability_end_date, sailing_experience, risk_level')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        const updates: Partial<FilterState> = {};

        // Pre-select departure location from profile
        if (profile.preferred_departure_location) {
          const loc = profile.preferred_departure_location as Location;
          updates.location = loc;
          updates.locationInput = loc.name;
        }

        // Pre-select arrival location from profile
        if (profile.preferred_arrival_location) {
          const loc = profile.preferred_arrival_location as Location;
          updates.arrivalLocation = loc;
          updates.arrivalLocationInput = loc.name;
        }

        // Pre-select date range from profile
        if (profile.availability_start_date || profile.availability_end_date) {
          updates.dateRange = {
            start: profile.availability_start_date ? new Date(profile.availability_start_date + 'T00:00:00') : null,
            end: profile.availability_end_date ? new Date(profile.availability_end_date + 'T00:00:00') : null,
          };
        }

        // Pre-select experience level from profile
        if (profile.sailing_experience !== null && profile.sailing_experience !== undefined) {
          updates.experienceLevel = profile.sailing_experience as ExperienceLevel;
        }

        // Pre-select risk level from profile
        if (profile.risk_level && Array.isArray(profile.risk_level) && profile.risk_level.length > 0) {
          updates.riskLevel = profile.risk_level as RiskLevel[];
        }

        if (Object.keys(updates).length > 0) {
          setFilters(prev => ({ ...prev, ...updates }));
          setLastUpdated(Date.now());
        }
      } catch (err) {
        console.error('Error loading profile preferences as filter defaults:', err);
      }
    };

    loadProfilePreferences();
  }, [isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

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
      console.error('Error saving filters to session:', err);
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
          console.error('Error clearing filters from session on logout:', err);
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
        console.error('Error marking filters as cleared:', err);
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
