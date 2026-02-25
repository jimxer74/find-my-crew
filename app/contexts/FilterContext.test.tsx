import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FilterProvider, useFilters } from './FilterContext';
import { setupSessionStorageMock, cleanupSessionStorageMock } from '@/__tests__/utils/test-utils';
import { ExperienceLevel } from '@shared/types/experience-levels';

describe('FilterContext', () => {
  let mockStorage: ReturnType<typeof setupSessionStorageMock>;

  beforeEach(() => {
    mockStorage = setupSessionStorageMock();
  });

  afterEach(() => {
    // Clear storage instead of deleting
    mockStorage.clear();
  });

  it('should provide default filter values', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    expect(result.current.filters.dateRange.start).toBeNull();
    expect(result.current.filters.dateRange.end).toBeNull();
    expect(result.current.filters.location).toBeNull();
    expect(result.current.filters.locationInput).toBe('');
    expect(result.current.filters.experienceLevel).toBeNull();
    expect(result.current.filters.riskLevel).toEqual([]);
  });

  it('should update filters when updateFilters is called', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    act(() => {
      result.current.updateFilters({
        experienceLevel: 2 as ExperienceLevel,
      });
    });

    expect(result.current.filters.experienceLevel).toBe(2);
  });

  it('should update multiple filters at once', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    act(() => {
      result.current.updateFilters({
        experienceLevel: 3 as ExperienceLevel,
        riskLevel: ['Coastal sailing'],
      });
    });

    expect(result.current.filters.experienceLevel).toBe(3);
    expect(result.current.filters.riskLevel).toEqual(['Coastal sailing']);
  });

  it('should clear all filters when clearFilters is called', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    // Set some filters
    act(() => {
      result.current.updateFilters({
        experienceLevel: 2 as ExperienceLevel,
        riskLevel: ['Coastal sailing'],
      });
    });

    // Clear filters
    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters.experienceLevel).toBeNull();
    expect(result.current.filters.riskLevel).toEqual([]);
  });

  it('should load filters from session storage on mount', () => {
    // Set up session storage with filter data
    const dateRange = {
      start: new Date(2024, 5, 15).toISOString(),
      end: new Date(2024, 5, 20).toISOString(),
    };
    mockStorage.setItem('crew-date-range', JSON.stringify(dateRange));

    const filters = {
      experienceLevel: 2,
      riskLevel: ['Coastal sailing'],
      location: null,
      locationInput: '',
    };
    mockStorage.setItem('crew-filters', JSON.stringify(filters));

    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    // Wait for initialization
    act(() => {
      // Force a re-render to ensure useEffect has run
    });

    // Check that filters were loaded
    expect(result.current.filters.dateRange.start).toBeInstanceOf(Date);
    expect(result.current.filters.dateRange.end).toBeInstanceOf(Date);
    expect(result.current.filters.experienceLevel).toBe(2);
    expect(result.current.filters.riskLevel).toEqual(['Coastal sailing']);
  });

  it('should save filters to session storage when updated', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    act(() => {
      result.current.updateFilters({
        experienceLevel: 3 as ExperienceLevel,
        riskLevel: ['Offshore sailing'],
      });
    });

    // Wait for save effect
    act(() => {
      // Force effect to run
    });

    const savedFilters = JSON.parse(mockStorage.getItem('crew-filters') || '{}');
    expect(savedFilters.experienceLevel).toBe(3);
    expect(savedFilters.riskLevel).toEqual(['Offshore sailing']);
  });

  it('should save date range to session storage when updated', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    const startDate = new Date(2024, 5, 15);
    const endDate = new Date(2024, 5, 20);

    act(() => {
      result.current.updateFilters({
        dateRange: { start: startDate, end: endDate },
      });
    });

    // Wait for save effect
    act(() => {
      // Force effect to run
    });

    const savedDateRange = JSON.parse(mockStorage.getItem('crew-date-range') || '{}');
    expect(savedDateRange.start).toBe(startDate.toISOString());
    expect(savedDateRange.end).toBe(endDate.toISOString());
  });

  it('should handle invalid session storage data gracefully', () => {
    mockStorage.setItem('crew-date-range', 'invalid json');
    mockStorage.setItem('crew-filters', 'invalid json');

    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    // Should not crash and should use defaults
    expect(result.current.filters.experienceLevel).toBeNull();
  });

  it('should update location and locationInput together', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FilterProvider,
    });

    const location = {
      name: 'Test Location',
      coordinates: [0, 0],
      place_name: 'Test Location, Test Country',
    };

    act(() => {
      result.current.updateFilters({
        location,
        locationInput: 'Test Location',
      });
    });

    expect(result.current.filters.location).toEqual(location);
    expect(result.current.filters.locationInput).toBe('Test Location');
  });
});
