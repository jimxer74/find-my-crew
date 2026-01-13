'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';

type Waypoint = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  name: string;
};

type LegFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  journeyId: string;
  legId: string | null; // null for creating new leg
};

export function LegFormModal({
  isOpen,
  onClose,
  onSuccess,
  journeyId,
  legId,
}: LegFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boatCapacity, setBoatCapacity] = useState<number | null>(null);

  // Form state
  const [legName, setLegName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [crewNeeded, setCrewNeeded] = useState<number | ''>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [editingWaypointIndex, setEditingWaypointIndex] = useState<number | null>(null);

  // Load boat capacity and leg data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBoatCapacity();
      if (legId) {
        loadLeg();
      } else {
        // Reset form for new leg
        resetForm();
      }
    }
  }, [isOpen, legId, journeyId]);

  const loadBoatCapacity = async () => {
    const supabase = getSupabaseBrowserClient();
    
    // Get journey's boat capacity
    const { data: journeyData, error: journeyError } = await supabase
      .from('journeys')
      .select('boat_id, boats(capacity)')
      .eq('id', journeyId)
      .single();

    if (journeyError) {
      console.error('Error loading boat capacity:', journeyError);
      return;
    }

    if (journeyData && (journeyData as any).boats) {
      const capacity = (journeyData as any).boats.capacity;
      setBoatCapacity(capacity);
    }
  };

  const resetForm = () => {
    setLegName('');
    setStartDate('');
    setEndDate('');
    setCrewNeeded('');
    setSkills([]);
    setWaypoints([]);
    setEditingWaypointIndex(null);
    setError(null);
  };

  const loadLeg = async () => {
    if (!legId) return;

    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    
    const { data, error } = await supabase
      .from('legs')
      .select('id, name, waypoints, start_date, end_date, crew_needed, skills')
      .eq('id', legId)
      .eq('journey_id', journeyId)
      .single();

    if (error) {
      console.error('Error loading leg:', error);
      setError('Failed to load leg');
      setLoading(false);
      return;
    }

    if (data) {
      const sortedWaypoints = [...(data.waypoints || [])].sort((a: any, b: any) => a.index - b.index);
      
      setLegName(data.name);
      setStartDate(data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '');
      setEndDate(data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '');
      setCrewNeeded(data.crew_needed || '');
      setSkills(data.skills || []);
      setWaypoints(sortedWaypoints);
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!legName.trim()) {
      setError('Leg name is required');
      return;
    }

    if (waypoints.length < 2) {
      setError('A leg must have at least a start and end waypoint');
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      const legData: any = {
        journey_id: journeyId,
        name: legName.trim(),
        waypoints: waypoints,
        updated_at: new Date().toISOString(),
      };

      if (startDate) {
        legData.start_date = new Date(startDate).toISOString();
      }
      if (endDate) {
        legData.end_date = new Date(endDate).toISOString();
      }
      // Set crew_needed: use provided value, or default to boat capacity - 1 (owner/skipper)
      if (crewNeeded !== '') {
        legData.crew_needed = Number(crewNeeded);
      } else if (boatCapacity && boatCapacity > 0) {
        // Default: boat capacity - 1 (assuming owner/skipper is always on board)
        legData.crew_needed = Math.max(0, boatCapacity - 1);
      }
      if (skills.length > 0) {
        legData.skills = skills;
      }

      if (legId) {
        // Update existing leg
        const { error: updateError } = await supabase
          .from('legs')
          .update(legData)
          .eq('id', legId)
          .eq('journey_id', journeyId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new leg
        const { error: insertError } = await supabase
          .from('legs')
          .insert(legData)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save leg');
    } finally {
      setSaving(false);
    }
  };

  const handleWaypointLocationChange = (waypointIndex: number, location: Location) => {
    const updatedWaypoints = [...waypoints];
    const waypoint = updatedWaypoints.find(wp => wp.index === waypointIndex);
    if (waypoint) {
      waypoint.geocode = {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      };
      waypoint.name = location.name;
      setWaypoints(updatedWaypoints);
      setEditingWaypointIndex(null);
    }
  };

  const handleAddWaypoint = (arrayIndex: number) => {
    // Add a new waypoint after the waypoint at arrayIndex
    const currentWaypoint = waypoints[arrayIndex];
    if (!currentWaypoint) return;

    const newIndex = currentWaypoint.index + 1;
    const newWaypoint: Waypoint = {
      index: newIndex,
      geocode: {
        type: 'Point',
        coordinates: currentWaypoint.geocode.coordinates, // Use same location as current waypoint initially
      },
      name: '',
    };

    // Reindex all waypoints after the insertion point
    const updatedWaypoints = [...waypoints];
    updatedWaypoints.forEach((wp) => {
      if (wp.index >= newIndex) {
        wp.index = wp.index + 1;
      }
    });
    
    // Insert new waypoint at the correct position
    updatedWaypoints.splice(arrayIndex + 1, 0, newWaypoint);
    setWaypoints(updatedWaypoints);
    setEditingWaypointIndex(newIndex);
  };

  const handleRemoveWaypoint = (index: number) => {
    if (waypoints.length <= 2) {
      setError('A leg must have at least a start and end waypoint');
      return;
    }

    const updatedWaypoints = waypoints.filter((wp) => wp.index !== index);
    // Reindex remaining waypoints
    updatedWaypoints.forEach((wp, idx) => {
      wp.index = idx;
    });
    setWaypoints(updatedWaypoints);
    setEditingWaypointIndex(null);
  };

  const handleSkillChange = (skill: string, checked: boolean) => {
    if (checked) {
      setSkills([...skills, skill]);
    } else {
      setSkills(skills.filter(s => s !== skill));
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
          className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-card-foreground">
                {legId ? 'Edit Leg' : 'Create New Leg'}
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

            {loading ? (
              <div className="text-center py-8">
                <div className="text-xl">Loading...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Leg Name */}
                <div>
                  <label htmlFor="leg-name" className="block text-sm font-medium text-foreground mb-1">
                    Leg Name *
                  </label>
                  <input
                    type="text"
                    id="leg-name"
                    value={legName}
                    onChange={(e) => setLegName(e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    placeholder="e.g., Barcelona to Palma"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-foreground mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start-date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-foreground mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end-date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    />
                  </div>
                </div>

                {/* Crew Needed */}
                <div>
                  <label htmlFor="crew-needed" className="block text-sm font-medium text-foreground mb-1">
                    Crew Needed
                    {boatCapacity !== null && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (max: {boatCapacity})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    id="crew-needed"
                    value={crewNeeded}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : Number(e.target.value);
                      if (value === '' || (typeof value === 'number' && value >= 0 && (boatCapacity === null || value <= boatCapacity))) {
                        setCrewNeeded(value);
                      }
                    }}
                    min="0"
                    max={boatCapacity || undefined}
                    step="1"
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    placeholder="Number of crew members needed"
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Required Skills
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {['Navigation', 'Cooking', 'Engine Maintenance', 'Sailing', 'First Aid', 'Diving'].map((skill) => (
                      <label key={skill} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.includes(skill)}
                          onChange={(e) => handleSkillChange(skill, e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">{skill}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Waypoints */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-foreground">
                      Waypoints *
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {waypoints.length === 0 ? (
                    <div className="text-sm text-muted-foreground mb-4">
                      No waypoints yet. Add a start and end waypoint to create a leg.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {waypoints.map((waypoint, idx) => {
                        const isStart = waypoint.index === 0;
                        const isEnd = waypoint.index === waypoints.length - 1;
                        const isEditing = editingWaypointIndex === waypoint.index;
                        const [lng, lat] = waypoint.geocode.coordinates;
                        const currentLocation: Location = {
                          name: waypoint.name,
                          lat: lat,
                          lng: lng,
                        };

                        return (
                          <div key={`${waypoint.index}-${idx}`} className="border border-border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {isStart ? 'START' : isEnd ? 'END' : `WAYPOINT ${waypoint.index}`}
                                </span>
                              </div>
                              {!isStart && !isEnd && (
                                <button
                                  onClick={() => handleRemoveWaypoint(waypoint.index)}
                                  className="text-destructive hover:opacity-80 text-sm"
                                  title="Remove waypoint"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            {isEditing ? (
                              <LocationAutocomplete
                                value={currentLocation.name}
                                onChange={(location) => {
                                  handleWaypointLocationChange(waypoint.index, location);
                                }}
                                onInputChange={(value) => {
                                  // Update name while typing
                                  const updated = [...waypoints];
                                  const wp = updated.find(w => w.index === waypoint.index);
                                  if (wp) {
                                    wp.name = value;
                                    setWaypoints(updated);
                                  }
                                }}
                                placeholder="Search for location..."
                                className="mb-2"
                              />
                            ) : (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-card-foreground">
                                  {waypoint.name || 'Unnamed location'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {lat.toFixed(4)}, {lng.toFixed(4)}
                                </div>
                                <button
                                  onClick={() => setEditingWaypointIndex(waypoint.index)}
                                  className="text-sm text-primary hover:opacity-80"
                                >
                                  Change location
                                </button>
                              </div>
                            )}
                            {idx < waypoints.length - 1 && (
                              <button
                                onClick={() => handleAddWaypoint(idx)}
                                className="mt-2 text-xs text-primary hover:opacity-80"
                              >
                                + Add waypoint after this
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 pt-4 border-t border-border">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !legName.trim() || waypoints.length < 2}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    {saving ? 'Saving...' : legId ? 'Save Changes' : 'Create Leg'}
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
