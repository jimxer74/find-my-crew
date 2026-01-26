'use client';

import { useState, useRef, useEffect } from 'react';

export type Location = {
  name: string;
  lat: number;
  lng: number;
  countryCode?: string;  // ISO 3166-1 alpha-2 code (e.g., US, GB, FR)
  countryName?: string;  // Full country name
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
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

  // Fetch location suggestions from Mapbox Search Box API with debouncing
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
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        console.warn('Mapbox access token not configured');
        return;
      }

      const sessionToken = sessionTokenRef.current;
      if (!sessionToken) {
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
        const newSuggestions = (data.suggestions || [])
          .map((suggestion: any) => ({
            mapbox_id: suggestion.mapbox_id,
            name: suggestion.name || suggestion.full_address || suggestion.place_formatted,
            full_address: suggestion.full_address,
            place_formatted: suggestion.place_formatted,
            feature_type: suggestion.feature_type,
            context: suggestion.context || {},
          }))
          .slice(0, 8); // Take top 8 most relevant

        setSuggestions(newSuggestions);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Error fetching location suggestions:', err);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    // Store timeout reference
    searchTimeoutRef.current = timeoutId;
  };

  // Handle location selection from autocomplete - retrieve full details with coordinates
  const handleLocationSelect = async (suggestion: any) => {
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
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.mapbox_id || `suggestion-${index}`}
              type="button"
              onClick={() => handleLocationSelect(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-accent transition-colors border-b border-border last:border-b-0"
            >
              <div className="font-medium text-card-foreground">{suggestion.name}</div>
              {suggestion.place_formatted && (
                <div className="text-sm text-muted-foreground">{suggestion.place_formatted}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
