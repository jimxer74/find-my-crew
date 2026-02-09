'use client';

import { useState, useRef, useEffect } from 'react';
import { searchLocation, type LocationSearchResult } from '@/app/lib/geocoding/locations';

export type Location = {
  name: string;
  lat: number;
  lng: number;
  countryCode?: string;  // ISO 3166-1 alpha-2 code (e.g., US, GB, FR)
  countryName?: string;  // Full country name
  isCruisingRegion?: boolean;  // True if this is a predefined cruising area
  bbox?: {  // Bounding box for cruising regions
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
};

// Unified suggestion type for both Mapbox and cruising regions
type Suggestion = {
  id: string;
  name: string;
  subtitle?: string;
  isCruisingRegion: boolean;
  // Mapbox-specific
  mapbox_id?: string;
  place_formatted?: string;
  // Cruising region-specific
  category?: string;
  description?: string;
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
};

export type LocationAutocompleteProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (location: Location) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  types?: string;
  className?: string;
};

export function LocationAutocomplete({
  id,
  label,
  value,
  onChange,
  onInputChange,
  placeholder = 'e.g., Barcelona, Spain',
  required = false,
  types = 'region, city, country, place',
  className = '',
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Generate UUIDv4 for session token
  const generateSessionToken = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Format category name for display
  const formatCategory = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Fetch location suggestions from Mapbox Search Box API and cruising regions with debouncing
  const fetchLocationSuggestions = (query: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      sessionTokenRef.current = null;
      return;
    }

    // Generate session token if not exists
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = generateSessionToken();
    }

    // Debounce API calls - wait 300ms after user stops typing
    const timeoutId = setTimeout(async () => {
      // Search cruising regions first (instant, no API call)
      const cruisingResults = searchLocation(query);
      const cruisingSuggestions: Suggestion[] = cruisingResults
        .slice(0, 5) // Limit to top 5 cruising regions
        .map((result: LocationSearchResult) => ({
          id: `cruising-${result.region.name}`,
          name: result.region.name,
          subtitle: `Cruising Area • ${formatCategory(result.region.category)}`,
          isCruisingRegion: true,
          category: result.region.category,
          description: result.region.description,
          bbox: result.region.bbox,
        }));

      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        console.warn('Mapbox access token not configured');
        // Still show cruising regions even without Mapbox
        setSuggestions(cruisingSuggestions);
        setShowSuggestions(cruisingSuggestions.length > 0);
        return;
      }

      const sessionToken = sessionTokenRef.current;
      if (!sessionToken) {
        setSuggestions(cruisingSuggestions);
        setShowSuggestions(cruisingSuggestions.length > 0);
        return;
      }

      try {
        // Use Mapbox Search Box API /suggest endpoint
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?` +
          `q=${encodeURIComponent(query)}&` +
          `access_token=${accessToken}&` +
          `session_token=${sessionToken}&` +
          `types=${encodeURIComponent(types)}&` +
          `limit=10&` +
          `language=en`
        );

        if (!response.ok) {
          throw new Error('Search Box API error');
        }

        const data = await response.json();
        const mapboxSuggestions: Suggestion[] = (data.suggestions || [])
          .map((suggestion: any) => ({
            id: suggestion.mapbox_id,
            mapbox_id: suggestion.mapbox_id,
            name: suggestion.name || suggestion.full_address || suggestion.place_formatted,
            subtitle: suggestion.place_formatted,
            place_formatted: suggestion.place_formatted,
            isCruisingRegion: false,
          }))
          .slice(0, 6); // Take top 6 from Mapbox

        // Merge: cruising regions first (sorted by score), then Mapbox results
        const mergedSuggestions = [...cruisingSuggestions, ...mapboxSuggestions];

        setSuggestions(mergedSuggestions);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Error fetching location suggestions:', err);
        // Still show cruising regions on error
        setSuggestions(cruisingSuggestions);
        setShowSuggestions(cruisingSuggestions.length > 0);
      }
    }, 300);

    // Store timeout reference
    searchTimeoutRef.current = timeoutId;
  };

  // Handle location selection from autocomplete - retrieve full details with coordinates
  const handleLocationSelect = async (suggestion: Suggestion) => {
    // Handle cruising region selection - no API call needed
    if (suggestion.isCruisingRegion && suggestion.bbox) {
      // Calculate center point from bounding box
      const lat = (suggestion.bbox.minLat + suggestion.bbox.maxLat) / 2;
      const lng = (suggestion.bbox.minLng + suggestion.bbox.maxLng) / 2;

      onChange({
        name: suggestion.name,
        lat,
        lng,
        isCruisingRegion: true,
        bbox: suggestion.bbox,  // Include the predefined bounding box
      });

      setInputValue(suggestion.name);
      setShowSuggestions(false);
      setSuggestions([]);
      sessionTokenRef.current = null;
      return;
    }

    // Handle Mapbox location selection
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('Mapbox access token not configured');
      return;
    }

    const sessionToken = sessionTokenRef.current;
    if (!sessionToken || !suggestion.mapbox_id) {
      return;
    }

    try {
      // Use Mapbox Search Box API /retrieve endpoint to get coordinates
      const response = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?` +
        `access_token=${accessToken}&` +
        `session_token=${sessionToken}&` +
        `language=en`
      );

      if (!response.ok) {
        throw new Error('Failed to retrieve location details');
      }

      const data = await response.json();
      const feature = data.features?.[0];

      if (feature && feature.geometry && feature.geometry.coordinates) {
        const [lng, lat] = feature.geometry.coordinates;
        const locationName = feature.properties?.full_address ||
                            feature.properties?.name ||
                            suggestion.name;

        // Extract country information from context
        const context = feature.properties?.context;
        const countryInfo = context?.country;
        const countryCode = countryInfo?.country_code?.toUpperCase();
        const countryName = countryInfo?.name;

        onChange({
          name: locationName,
          lat: lat,
          lng: lng,
          countryCode,
          countryName,
          isCruisingRegion: false,
        });

        setInputValue(locationName);
        // Don't call onInputChange when selecting from suggestions - only onChange
        // onInputChange should only be called when user is typing
        setShowSuggestions(false);
        setSuggestions([]);
        sessionTokenRef.current = null; // Reset session token
      }
    } catch (err) {
      console.error('Error retrieving location details:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (onInputChange) {
      onInputChange(newValue);
    }
    fetchLocationSuggestions(newValue);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <input
        type="text"
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleLocationSelect(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-accent transition-colors border-b border-border last:border-b-0"
            >
              <div className="font-medium text-card-foreground">
                {suggestion.name}
              </div>
              {suggestion.subtitle && (
                <div className={`text-sm ${
                  suggestion.isCruisingRegion
                    ? 'text-sky-600/80 dark:text-sky-400/80'
                    : 'text-muted-foreground'
                }`}>
                  {suggestion.subtitle}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
