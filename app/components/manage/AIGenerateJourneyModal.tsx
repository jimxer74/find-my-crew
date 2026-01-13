'use client';

import { useState, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type Boat = {
  id: string;
  name: string;
};

type AIGenerateJourneyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
};

export function AIGenerateJourneyModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId 
}: AIGenerateJourneyModalProps) {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoatId, setSelectedBoatId] = useState('');
  const [startLocation, setStartLocation] = useState({ name: '', lat: 0, lng: 0 });
  const [endLocation, setEndLocation] = useState({ name: '', lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedJourney, setGeneratedJourney] = useState<any>(null);
  const [startSuggestions, setStartSuggestions] = useState<any[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<any[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const startSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const endSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startSessionTokenRef = useRef<string | null>(null);
  const endSessionTokenRef = useRef<string | null>(null);

  // Load boats when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBoats();
    }
  }, [isOpen]);

  const loadBoats = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', userId)
      .order('name', { ascending: true });

    if (fetchError) {
      setError('Failed to load boats');
    } else {
      setBoats(data || []);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBoatId || !startLocation.name || !endLocation.name) {
      setError('Please fill in all fields');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedJourney(null);

    // Use coordinates from autocomplete if available, otherwise try to geocode
    let startCoords = { lat: startLocation.lat, lng: startLocation.lng };
    let endCoords = { lat: endLocation.lat, lng: endLocation.lng };

    // If coordinates are not set (0,0), try to geocode the location name
    if ((startCoords.lat === 0 && startCoords.lng === 0) || !startLocation.name) {
      setError('Please select a valid start location from the suggestions');
      setGenerating(false);
      return;
    }

    if ((endCoords.lat === 0 && endCoords.lng === 0) || !endLocation.name) {
      setError('Please select a valid end location from the suggestions');
      setGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/ai/generate-journey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boatId: selectedBoatId,
          startLocation: {
            name: startLocation.name,
            lat: startCoords.lat,
            lng: startCoords.lng,
          },
          endLocation: {
            name: endLocation.name,
            lat: endCoords.lat,
            lng: endCoords.lng,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate journey');
      }

      setGeneratedJourney(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate journey');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async () => {
    if (!generatedJourney || !selectedBoatId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // Create the journey
      const { data: journeyData, error: journeyError } = await supabase
        .from('journeys')
        .insert({
          boat_id: selectedBoatId,
          name: generatedJourney.journeyName,
          description: generatedJourney.description || '',
          state: 'In planning',
        })
        .select()
        .single();

      if (journeyError) throw journeyError;

      // Create the legs
      for (const leg of generatedJourney.legs) {
        const { error: legError } = await supabase
          .from('legs')
          .insert({
            journey_id: journeyData.id,
            name: leg.name,
            waypoints: leg.waypoints,
          });

        if (legError) throw legError;
      }

      onSuccess();
      onClose();
      // Reset form
      setSelectedBoatId('');
      setStartLocation({ name: '', lat: 0, lng: 0 });
      setEndLocation({ name: '', lat: 0, lng: 0 });
      setGeneratedJourney(null);
      setStartSuggestions([]);
      setEndSuggestions([]);
      setShowStartSuggestions(false);
      setShowEndSuggestions(false);
      startSessionTokenRef.current = null;
      endSessionTokenRef.current = null;
    } catch (err: any) {
      setError(err.message || 'Failed to save journey');
    } finally {
      setLoading(false);
    }
  };

  // Generate UUIDv4 for session token
  const generateSessionToken = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Fetch location suggestions from Mapbox Search Box API with debouncing
  const fetchLocationSuggestions = (query: string, isStart: boolean) => {
    // Clear existing timeout
    if (isStart && startSearchTimeoutRef.current) {
      clearTimeout(startSearchTimeoutRef.current);
    } else if (!isStart && endSearchTimeoutRef.current) {
      clearTimeout(endSearchTimeoutRef.current);
    }

    if (!query || query.length < 2) {
      if (isStart) {
        setStartSuggestions([]);
        setShowStartSuggestions(false);
        startSessionTokenRef.current = null;
      } else {
        setEndSuggestions([]);
        setShowEndSuggestions(false);
        endSessionTokenRef.current = null;
      }
      return;
    }

    // Generate session token if not exists
    if (isStart && !startSessionTokenRef.current) {
      startSessionTokenRef.current = generateSessionToken();
    } else if (!isStart && !endSessionTokenRef.current) {
      endSessionTokenRef.current = generateSessionToken();
    }

    // Debounce API calls - wait 300ms after user stops typing
    const timeoutId = setTimeout(async () => {
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        console.warn('Mapbox access token not configured');
        return;
      }

      const sessionToken = isStart 
        ? startSessionTokenRef.current 
        : endSessionTokenRef.current;

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
          `types=region, city, country, place&` +
          `limit=10&` +
          `language=en`
        );

        if (!response.ok) {
          throw new Error('Search Box API error');
        }

        const data = await response.json();
        const suggestions = (data.suggestions || [])
          .map((suggestion: any) => ({
            mapbox_id: suggestion.mapbox_id,
            name: suggestion.name || suggestion.full_address || suggestion.place_formatted,
            full_address: suggestion.full_address,
            place_formatted: suggestion.place_formatted,
            feature_type: suggestion.feature_type,
            context: suggestion.context || {},
          }))
          .slice(0, 8); // Take top 8 most relevant

        if (isStart) {
          setStartSuggestions(suggestions);
          setShowStartSuggestions(true);
        } else {
          setEndSuggestions(suggestions);
          setShowEndSuggestions(true);
        }
      } catch (err) {
        console.error('Error fetching location suggestions:', err);
        if (isStart) {
          setStartSuggestions([]);
          setShowStartSuggestions(false);
        } else {
          setEndSuggestions([]);
          setShowEndSuggestions(false);
        }
      }
    }, 300);

    // Store timeout reference
    if (isStart) {
      startSearchTimeoutRef.current = timeoutId;
    } else {
      endSearchTimeoutRef.current = timeoutId;
    }
  };

  // Handle location selection from autocomplete - retrieve full details with coordinates
  const handleLocationSelect = async (suggestion: any, isStart: boolean) => {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('Mapbox access token not configured');
      return;
    }

    const sessionToken = isStart 
      ? startSessionTokenRef.current 
      : endSessionTokenRef.current;

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

        if (isStart) {
          setStartLocation({
            name: locationName,
            lat: lat,
            lng: lng,
          });
          setShowStartSuggestions(false);
          setStartSuggestions([]);
          startSessionTokenRef.current = null; // Reset session token
        } else {
          setEndLocation({
            name: locationName,
            lat: lat,
            lng: lng,
          });
          setShowEndSuggestions(false);
          setEndSuggestions([]);
          endSessionTokenRef.current = null; // Reset session token
        }
      }
    } catch (err) {
      console.error('Error retrieving location details:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-card-foreground">
                Generate Journey with AI (Test)
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {!generatedJourney ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="boat_id" className="block text-sm font-medium text-foreground mb-1">
                    Boat *
                  </label>
                  <select
                    id="boat_id"
                    value={selectedBoatId}
                    onChange={(e) => setSelectedBoatId(e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  >
                    <option value="">Select a boat</option>
                    {boats.map((boat) => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <label htmlFor="start_location" className="block text-sm font-medium text-foreground mb-1">
                    Start Location *
                  </label>
                  <input
                    type="text"
                    id="start_location"
                    value={startLocation.name}
                    onChange={(e) => {
                      setStartLocation({ ...startLocation, name: e.target.value });
                      fetchLocationSuggestions(e.target.value, true);
                    }}
                    onFocus={() => {
                      if (startSuggestions.length > 0) {
                        setShowStartSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow click on suggestion
                      setTimeout(() => setShowStartSuggestions(false), 200);
                    }}
                    placeholder="e.g., Barcelona, Spain"
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                  {showStartSuggestions && startSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {startSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.mapbox_id || `start-suggestion-${index}`}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion, true)}
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

                <div className="relative">
                  <label htmlFor="end_location" className="block text-sm font-medium text-foreground mb-1">
                    End Location *
                  </label>
                  <input
                    type="text"
                    id="end_location"
                    value={endLocation.name}
                    onChange={(e) => {
                      setEndLocation({ ...endLocation, name: e.target.value });
                      fetchLocationSuggestions(e.target.value, false);
                    }}
                    onFocus={() => {
                      if (endSuggestions.length > 0) {
                        setShowEndSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow click on suggestion
                      setTimeout(() => setShowEndSuggestions(false), 200);
                    }}
                    placeholder="e.g., Palma, Mallorca"
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                  {showEndSuggestions && endSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {endSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.mapbox_id || `end-suggestion-${index}`}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion, false)}
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

                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating || !selectedBoatId || !startLocation.name || !endLocation.name}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    {generating ? 'Generating...' : 'Generate Journey'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">
                    Generated Journey: {generatedJourney.journeyName}
                  </h3>
                  {generatedJourney.description && (
                    <p className="text-muted-foreground mb-4">{generatedJourney.description}</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-card-foreground mb-2">Legs:</h4>
                  <div className="space-y-2">
                    {generatedJourney.legs.map((leg: any, idx: number) => (
                      <div key={idx} className="bg-accent/50 p-3 rounded">
                        <p className="font-medium">{leg.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {leg.waypoints.length} waypoint{leg.waypoints.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedJourney(null);
                      setError(null);
                    }}
                    className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    {loading ? 'Saving...' : 'Accept & Create Journey'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
