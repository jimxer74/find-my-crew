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
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setLastUpdated(Date.now()); // Update timestamp to trigger reloads
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilters, clearFilters, lastUpdated }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
