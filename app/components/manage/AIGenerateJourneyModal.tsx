'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';

type Boat = {
  id: string;
  name: string;
  average_speed_knots?: number | null;
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
  const router = useRouter();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoatId, setSelectedBoatId] = useState('');
  const [selectedBoatSpeed, setSelectedBoatSpeed] = useState<number | null>(null);
  const [startLocation, setStartLocation] = useState({ name: '', lat: 0, lng: 0 });
  const [endLocation, setEndLocation] = useState({ name: '', lat: 0, lng: 0 });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useSpeedPlanning, setUseSpeedPlanning] = useState(false);
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
      setSelectedBoatSpeed(null);
      setStartLocation({ name: '', lat: 0, lng: 0 });
      setEndLocation({ name: '', lat: 0, lng: 0 });
      setStartDate('');
      setEndDate('');
      setUseSpeedPlanning(false);
      setGeneratedJourney(null);
      setError(null);
    }
  }, [isOpen]);

  const loadBoats = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('id, name, average_speed_knots')
      .eq('owner_id', userId)
      .order('name', { ascending: true });

    if (fetchError) {
      setError('Failed to load boats');
    } else {
      setBoats(data || []);
    }
  };

  // Load boat speed when boat is selected
  useEffect(() => {
    if (selectedBoatId) {
      const selectedBoat = boats.find(b => b.id === selectedBoatId);
      setSelectedBoatSpeed(selectedBoat?.average_speed_knots || null);
    } else {
      setSelectedBoatSpeed(null);
    }
  }, [selectedBoatId, boats]);

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
          startDate: startDate || null,
          endDate: endDate || null,
          useSpeedPlanning: useSpeedPlanning,
          boatSpeed: selectedBoatSpeed || null,
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
      const journeyInsertData: any = {
        boat_id: selectedBoatId,
        name: generatedJourney.journeyName,
        description: generatedJourney.description || '',
        state: 'In planning',
      };

      // Add dates if provided
      if (startDate) {
        journeyInsertData.start_date = startDate;
      }
      if (endDate) {
        journeyInsertData.end_date = endDate;
      }

      const { data: journeyData, error: journeyError } = await supabase
        .from('journeys')
        .insert(journeyInsertData)
        .select()
        .single();

      if (journeyError) throw journeyError;

      // Create the legs
      for (const leg of generatedJourney.legs) {
        const legInsertData: any = {
          journey_id: journeyData.id,
          name: leg.name,
          waypoints: leg.waypoints,
        };

        // Add leg dates if provided (from speed-based planning)
        if (leg.start_date) {
          legInsertData.start_date = leg.start_date;
        }
        if (leg.end_date) {
          legInsertData.end_date = leg.end_date;
        }

        const { error: legError } = await supabase
          .from('legs')
          .insert(legInsertData);

        if (legError) throw legError;
      }

      // Call onSuccess callback
      onSuccess();
      
      // Close the modal
      onClose();
      
      // Navigate to the EditJourneyMap page for the newly created journey
      router.push(`/owner/journeys/${journeyData.id}/legs`);
      
      // Reset form
      setSelectedBoatId('');
      setSelectedBoatSpeed(null);
      setStartLocation({ name: '', lat: 0, lng: 0 });
      setEndLocation({ name: '', lat: 0, lng: 0 });
      setStartDate('');
      setEndDate('');
      setUseSpeedPlanning(false);
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
              <h2 className="text-2xl font-bold text-card-foreground flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Propose new Journey
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

                {/* Start and End Location on same row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                {/* Start and End Date on same row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-foreground mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setError(null);
                      }}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium text-foreground mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setError(null);
                      }}
                      min={startDate || undefined}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    />
                  </div>
                </div>

                {/* Use boat average speed planning checkbox */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSpeedPlanning}
                      onChange={(e) => {
                        setUseSpeedPlanning(e.target.checked);
                        setError(null);
                      }}
                      disabled={!selectedBoatSpeed || !startDate || !endDate}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">
                      Use boat average speed planning
                      {selectedBoatSpeed && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({selectedBoatSpeed} knots)
                        </span>
                      )}
                    </span>
                  </label>
                  {useSpeedPlanning && (!selectedBoatSpeed || !startDate || !endDate) && (
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      {!selectedBoatSpeed && 'Boat speed is required. '}
                      {!startDate && 'Start date is required. '}
                      {!endDate && 'End date is required.'}
                    </p>
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
