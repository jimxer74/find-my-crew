'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';

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

  // Load boats when modal opens and reset form
  useEffect(() => {
    if (isOpen) {
      loadBoats();
      // Reset form state when modal opens
      setSelectedBoatId('');
      setStartLocation({ name: '', lat: 0, lng: 0 });
      setEndLocation({ name: '', lat: 0, lng: 0 });
      setGeneratedJourney(null);
      setError(null);
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
    // Clear any previous errors first
    setError(null);

    // Validate all fields are filled
    if (!selectedBoatId || !startLocation.name || !endLocation.name) {
      setError('Please fill in all fields');
      return;
    }

    // Validate coordinates are set (user must select from autocomplete suggestions)
    const hasValidStartCoords = startLocation.lat !== 0 && startLocation.lng !== 0;
    const hasValidEndCoords = endLocation.lat !== 0 && endLocation.lng !== 0;

    if (!hasValidStartCoords) {
      setError('Please select a valid start location from the autocomplete suggestions');
      return;
    }

    if (!hasValidEndCoords) {
      setError('Please select a valid end location from the autocomplete suggestions');
      return;
    }

    // All validations passed, proceed with generation
    setGenerating(true);
    setError(null);
    setGeneratedJourney(null);

    // Use coordinates from autocomplete
    let startCoords = { lat: startLocation.lat, lng: startLocation.lng };
    let endCoords = { lat: endLocation.lat, lng: endLocation.lng };

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
    } catch (err: any) {
      setError(err.message || 'Failed to save journey');
    } finally {
      setLoading(false);
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
                    onChange={(e) => {
                      setSelectedBoatId(e.target.value);
                      setError(null); // Clear error when boat is selected
                    }}
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

                <LocationAutocomplete
                  id="start_location"
                  label="Start Location"
                  value={startLocation.name}
                  onChange={(location) => {
                    setStartLocation(location);
                    setError(null); // Clear error when valid location is selected
                  }}
                  onInputChange={(value) => {
                    setStartLocation({ name: value, lat: 0, lng: 0 }); // Reset coordinates when typing
                    setError(null); // Clear error when user starts typing
                  }}
                  placeholder="e.g., Barcelona, Spain"
                  required
                />

                <LocationAutocomplete
                  id="end_location"
                  label="End Location"
                  value={endLocation.name}
                  onChange={(location) => {
                    setEndLocation(location);
                    setError(null); // Clear error when valid location is selected
                  }}
                  onInputChange={(value) => {
                    setEndLocation({ name: value, lat: 0, lng: 0 }); // Reset coordinates when typing
                    setError(null); // Clear error when user starts typing
                  }}
                  placeholder="e.g., Palma, Mallorca"
                  required
                />

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
