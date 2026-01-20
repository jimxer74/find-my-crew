'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { DateRange } from '@/app/components/ui/DateRangePicker';
import { Location } from '@/app/components/ui/LocationAutocomplete';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type FilterState = {
  dateRange: DateRange;
  location: Location | null;
  locationInput: string;
  experienceLevel: ExperienceLevel | null;
  riskLevel: RiskLevel[];
};

type FilterContextType = {
  filters: FilterState;
  updateFilters: (updates: Partial<FilterState>) => void;
  clearFilters: () => void;
};

const defaultFilters: FilterState = {
  dateRange: { start: null, end: null },
  location: null,
  locationInput: '',
  experienceLevel: null,
  riskLevel: [],
};

const FilterContext = createContext<FilterContextType>({
  filters: defaultFilters,
  updateFilters: () => {},
  clearFilters: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isInitialized, setIsInitialized] = useState(false);

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
        experienceLevel: null as ExperienceLevel | null,
        riskLevel: [] as RiskLevel[],
      };

      if (filtersStored) {
        const parsed = JSON.parse(filtersStored);
        if (parsed.location) {
          otherFilters.location = parsed.location as Location;
          otherFilters.locationInput = parsed.locationInput || '';
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
        experienceLevel: filters.experienceLevel,
        riskLevel: filters.riskLevel,
      };
      sessionStorage.setItem('crew-filters', JSON.stringify(filtersSerialized));
    } catch (err) {
      console.error('Error saving filters to session:', err);
    }
  }, [filters, isInitialized]);

  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilters, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
