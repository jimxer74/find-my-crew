'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import skillsConfig from '@/app/config/skills-config.json';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

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
  const [journeyDefaultsLoaded, setJourneyDefaultsLoaded] = useState(false);
  const [journeyDefaultsApplied, setJourneyDefaultsApplied] = useState(false);

  // Form state
  const [legName, setLegName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [crewNeeded, setCrewNeeded] = useState<number | ''>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [editingWaypointIndex, setEditingWaypointIndex] = useState<number | null>(null);

  // Load boat capacity and leg data when modal opens
  useEffect(() => {
    if (isOpen) {
      setJourneyDefaultsApplied(false); // Reset flag when modal opens
      if (legId) {
        // Editing existing leg - load leg data first, then load journey data for capacity
        loadLeg();
        loadBoatCapacity(legId); // Load journey data (defaults will be applied by useEffect if needed)
      } else {
        // Creating new leg - reset form first, then load journey defaults
        resetForm();
        // Load journey defaults after a brief delay to ensure state is reset
        const timer = setTimeout(() => {
          loadBoatCapacity(null); // This will set risk level and skills from journey
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, legId, journeyId]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('Risk level state changed to:', riskLevel);
  }, [riskLevel]);

  useEffect(() => {
    console.log('Skills state changed to:', skills);
  }, [skills]);

  // Set journey defaults for existing legs that don't have values
  useEffect(() => {
    if (isOpen && legId && journeyDefaultsLoaded && (!riskLevel || skills.length === 0)) {
      console.log('Leg loaded but missing values, loading journey defaults');
      loadBoatCapacity(legId);
    }
  }, [isOpen, legId, riskLevel, skills, journeyDefaultsLoaded]);

  const loadBoatCapacity = async (currentLegId: string | null) => {
    const supabase = getSupabaseBrowserClient();
    
    // Get journey's boat capacity, risk level, and skills
    const { data: journeyData, error: journeyError } = await supabase
      .from('journeys')
      .select('boat_id, risk_level, skills, boats(capacity)')
      .eq('id', journeyId)
      .single();

    if (journeyError) {
      console.error('Error loading journey data:', journeyError);
      return;
    }

    console.log('Journey data loaded:', journeyData);
    console.log('Current legId parameter:', currentLegId);
    console.log('Journey risk_level:', (journeyData as any)?.risk_level);
    console.log('Journey skills:', (journeyData as any)?.skills);

    if (journeyData) {
      if ((journeyData as any).boats) {
        const capacity = (journeyData as any).boats.capacity;
        setBoatCapacity(capacity);
      }
      
      // Always check current state using functional updates to see if we need to set defaults
      // This works for both new legs and existing legs that don't have values
      setRiskLevel(currentRiskLevel => {
        setSkills(currentSkills => {
          const shouldSetRiskLevel = !currentRiskLevel;
          const shouldSetSkills = !currentSkills || currentSkills.length === 0;
          const shouldSetDefaults = !currentLegId || shouldSetRiskLevel || shouldSetSkills;
          
          if (shouldSetDefaults) {
            console.log('Setting defaults from journey. New leg:', !currentLegId, 'Missing risk level:', shouldSetRiskLevel, 'Missing skills:', shouldSetSkills);
            
            // Set default risk level from journey (use first one if array) - only if not already set
            if (shouldSetRiskLevel) {
              const journeyRiskLevels = (journeyData as any).risk_level as string[] | null;
              console.log('Journey risk levels:', journeyRiskLevels);
              if (journeyRiskLevels && journeyRiskLevels.length > 0) {
                const defaultRiskLevel = journeyRiskLevels[0] as RiskLevel;
                console.log('Setting risk level to:', defaultRiskLevel);
                if (defaultRiskLevel && ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].includes(defaultRiskLevel)) {
                  console.log('Calling setRiskLevel with:', defaultRiskLevel);
                  // Set risk level using setTimeout to avoid nested state updates
                  setTimeout(() => {
                    setRiskLevel(defaultRiskLevel);
                  }, 0);
                } else {
                  console.log('Risk level validation failed:', defaultRiskLevel);
                }
              }
            }

            // Set default skills from journey - only if not already set
            if (shouldSetSkills) {
              const journeySkills = (journeyData as any).skills as string[] | null;
              console.log('Journey skills:', journeySkills);
              if (journeySkills && journeySkills.length > 0) {
                console.log('Setting skills to:', journeySkills);
                const newSkills = [...journeySkills];
                console.log('New skills to set:', newSkills);
                // Return new skills array
                return newSkills;
              } else {
                console.log('No journey skills to set');
                return currentSkills;
              }
            }
            
            return currentSkills;
          } else {
            console.log('Leg already has risk level and skills, not setting defaults');
            return currentSkills;
          }
        });
        
        return currentRiskLevel;
      });
      
      // Mark that defaults have been loaded
      setJourneyDefaultsLoaded(true);
      console.log('Journey defaults loaded flag set to true');
    }
  };

  const resetForm = () => {
    setLegName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setCrewNeeded('');
    setWaypoints([]);
    setEditingWaypointIndex(null);
    setError(null);
    // Reset riskLevel and skills - they will be set from journey default in loadBoatCapacity
    setRiskLevel(null);
    setSkills([]);
  };

  const loadLeg = async () => {
    if (!legId) return;

    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    
    const { data, error } = await supabase
      .from('legs')
      .select('id, name, description, waypoints, start_date, end_date, crew_needed, skills, risk_level')
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
      setDescription(data.description || '');
      setStartDate(data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '');
      setEndDate(data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '');
      setCrewNeeded(data.crew_needed || '');
      // Set skills and risk level from leg data (may be null/empty, in which case journey defaults will be used)
      setSkills(data.skills || []);
      setRiskLevel((data.risk_level as RiskLevel) || null);
      setWaypoints(sortedWaypoints);
      
      console.log('Leg loaded - risk_level:', data.risk_level, 'skills:', data.skills);
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

    if (!riskLevel) {
      setError('Risk level is required');
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      const legData: any = {
        journey_id: journeyId,
        name: legName.trim(),
        description: description.trim() || null,
        risk_level: riskLevel,
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

                {/* Description */}
                <div>
                  <label htmlFor="leg-description" className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    id="leg-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
                    placeholder="Additional details about this leg (optional)"
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

                {/* Risk Level */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Risk Level
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="risk-level"
                        value="Coastal sailing"
                        checked={riskLevel === 'Coastal sailing'}
                        onChange={() => setRiskLevel('Coastal sailing')}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{riskLevelsConfig.coastal_sailing.title}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="risk-level"
                        value="Offshore sailing"
                        checked={riskLevel === 'Offshore sailing'}
                        onChange={() => setRiskLevel('Offshore sailing')}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{riskLevelsConfig.offshore_sailing.title}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="risk-level"
                        value="Extreme sailing"
                        checked={riskLevel === 'Extreme sailing'}
                        onChange={() => setRiskLevel('Extreme sailing')}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{riskLevelsConfig.extreme_sailing.title}</span>
                    </label>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Required Skills {skills.length > 0 && `(${skills.length} selected)`}
                  </label>
                  {/* Debug: Show current skills state */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Debug - Skills state: {JSON.stringify(skills)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      // Extract all unique skill names from all categories
                      const allSkills = [
                        ...skillsConfig.general,
                        ...skillsConfig.offshore,
                        ...skillsConfig.extreme
                      ];
                      // Convert snake_case to Title Case for display
                      const formatSkillName = (name: string) => {
                        return name
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      return allSkills.map((skill) => {
                        const displayName = formatSkillName(skill.name);
                        const isChecked = skills.includes(displayName);
                        // Debug log for each checkbox
                        if (process.env.NODE_ENV === 'development' && skills.length > 0) {
                          console.log(`Skill "${displayName}": checked=${isChecked}, in skills array=${skills.includes(displayName)}`);
                        }
                        return (
                          <label key={skill.name} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleSkillChange(displayName, e.target.checked)}
                              className="rounded border-border"
                            />
                            <span className="text-sm text-foreground">{displayName}</span>
                          </label>
                        );
                      });
                    })()}
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
