'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  excludeCruisingRegions?: boolean; // When true, excludes predefined cruising regions from suggestions
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
  autoFocus = false,
  inputRef: externalInputRef,
  excludeCruisingRegions = false,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Auto-focus input when autoFocus prop is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready, then focus
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      });
    }
  }, [autoFocus]);

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
      // Search cruising regions first (instant, no API call) - only if not excluded
      let cruisingSuggestions: Suggestion[] = [];
      
      if (!excludeCruisingRegions) {
        // Use a custom search for autocomplete that matches prefixes
        const normalizedQuery = query.toLowerCase().trim();
        const cruisingMatches: LocationSearchResult[] = [];
        
        // Import getAllRegions to search through all regions
        const { getAllRegions } = await import('@/app/lib/geocoding/locations');
        const allRegions = getAllRegions();
        
        for (const region of allRegions) {
          // Check if query matches region name (prefix match)
          const normalizedName = region.name.toLowerCase();
          if (normalizedName.startsWith(normalizedQuery) || normalizedName.includes(normalizedQuery)) {
            cruisingMatches.push({
              region,
              matchedOn: 'name',
              matchedTerm: region.name,
            });
            continue;
          }
          
          // Check aliases
          for (const alias of region.aliases) {
            const normalizedAlias = alias.toLowerCase();
            if (normalizedAlias.startsWith(normalizedQuery) || normalizedAlias.includes(normalizedQuery)) {
              cruisingMatches.push({
                region,
                matchedOn: 'alias',
                matchedTerm: alias,
              });
              break;
            }
          }
        }
        
        // Deduplicate by region name - a region might match both by name and alias
        const uniqueRegions = new Map<string, LocationSearchResult>();
        for (const match of cruisingMatches) {
          const regionName = match.region.name;
          if (!uniqueRegions.has(regionName)) {
            uniqueRegions.set(regionName, match);
          } else {
            // If already exists, prefer the one with better match (starts with query)
            const existing = uniqueRegions.get(regionName)!;
            const existingStartsWith = existing.matchedTerm.toLowerCase().startsWith(normalizedQuery);
            const currentStartsWith = match.matchedTerm.toLowerCase().startsWith(normalizedQuery);
            if (currentStartsWith && !existingStartsWith) {
              uniqueRegions.set(regionName, match);
            }
          }
        }
        
        // Sort by relevance: exact prefix matches first, then by length
        const deduplicatedMatches = Array.from(uniqueRegions.values());
        deduplicatedMatches.sort((a, b) => {
          const aStartsWith = a.matchedTerm.toLowerCase().startsWith(normalizedQuery);
          const bStartsWith = b.matchedTerm.toLowerCase().startsWith(normalizedQuery);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return a.matchedTerm.length - b.matchedTerm.length;
        });
        
        cruisingSuggestions = deduplicatedMatches
          .slice(0, 5) // Limit to top 5 cruising regions
          .map((result: LocationSearchResult) => ({
            id: `cruising-${result.region.name}`,
            name: result.region.name,
            subtitle: 'Cruising location',
            isCruisingRegion: true,
            category: result.region.category,
            description: result.region.description,
            bbox: result.region.bbox,
          }));
      }

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
    // Trigger search if query is long enough
    if (newValue.length >= 2) {
      fetchLocationSuggestions(newValue);
    } else {
      // Clear suggestions if query is too short
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Update dropdown position when input position changes or suggestions appear
  useEffect(() => {
    const updatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        // Make dropdown wider - at least 400px or 2x input width, whichever is larger
        const minWidth = 400;
        const dropdownWidth = Math.max(minWidth, rect.width * 2);
        
        // Use getBoundingClientRect for accurate positioning relative to viewport
        // Then add scroll offsets for proper positioning in portal
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        setDropdownPosition({
          top: rect.bottom + scrollTop + 4,
          left: rect.left + scrollLeft,
          width: dropdownWidth,
        });
      }
    };

    if (showSuggestions && suggestions.length > 0 && inputRef.current) {
      updatePosition();
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(updatePosition);
      
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showSuggestions, suggestions.length, inputValue]);

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
    // Trigger search if there's already input value
    if (inputValue && inputValue.length >= 2) {
      fetchLocationSuggestions(inputValue);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if focus is moving to the dropdown
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && dropdownRef.current && dropdownRef.current.contains(relatedTarget)) {
      return; // Don't hide if clicking into dropdown
    }
    // Delay hiding suggestions to allow click on suggestion
    setTimeout(() => {
      // Double-check that we're not clicking into the dropdown
      const activeElement = document.activeElement;
      if (activeElement && dropdownRef.current && dropdownRef.current.contains(activeElement)) {
        return; // Still focused on dropdown
      }
      // Also check if dropdown still exists and is visible
      if (!dropdownRef.current || !showSuggestions) {
        return;
      }
      setShowSuggestions(false);
    }, 200);
  };
  
  // Handle click on dropdown to prevent blur
  const handleDropdownMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent input blur
  };

  return (
    <div className={`relative ${className}`} style={{ zIndex: 100 }}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
      />
      {showSuggestions && suggestions.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto location-autocomplete-dropdown"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999,
          }}
          onMouseDown={handleDropdownMouseDown}
          data-location-autocomplete="true"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLocationSelect(suggestion);
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {suggestion.name}
              </div>
              {suggestion.subtitle && (
                <div className={`text-xs ${
                  suggestion.isCruisingRegion
                    ? 'text-sky-600 dark:text-sky-400 font-normal'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {suggestion.subtitle}
                </div>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
