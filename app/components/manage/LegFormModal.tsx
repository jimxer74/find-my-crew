'use client';

import { logger } from '@/app/lib/logger';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import skillsConfig from '@/app/config/skills-config.json';
import { postGISToWaypoint, validateCoordinates } from '@/app/lib/postgis-helpers';
import { ExperienceLevel, getAllExperienceLevels, getExperienceLevelConfig } from '@/app/types/experience-levels';
import { toDisplaySkillName } from '@/app/lib/skillUtils';
import { canCreateLeg } from '@/app/lib/limits';
import Image from 'next/image';

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
  const [limitReached, setLimitReached] = useState(false);
  const [boatCapacity, setBoatCapacity] = useState<number | null>(null);
  const [journeyDefaultsLoaded, setJourneyDefaultsLoaded] = useState(false);
  const [journeyDefaultsApplied, setJourneyDefaultsApplied] = useState(false);
  const [journeySkills, setJourneySkills] = useState<string[] | null>(null); // Journey-level skills (if any)
  const [journeyMinExperienceLevel, setJourneyMinExperienceLevel] = useState<ExperienceLevel | null>(null); // Journey-level min experience level (if any)

  // Form state
  const [legName, setLegName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [crewNeeded, setCrewNeeded] = useState<number | ''>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [minExperienceLevel, setMinExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [editingWaypointIndex, setEditingWaypointIndex] = useState<number | null>(null);

  // Check leg creation limit
  const checkLegLimit = async () => {
    const supabase = getSupabaseBrowserClient();
    const result = await canCreateLeg(supabase, journeyId);
    if (!result.allowed) {
      setLimitReached(true);
      setError(result.message || 'Leg limit reached for this journey');
    } else {
      setLimitReached(false);
    }
  };

  // Load boat capacity and leg data when modal opens
  useEffect(() => {
    if (isOpen) {
      setLimitReached(false); // Reset limit flag when modal opens
      setJourneyDefaultsApplied(false); // Reset flag when modal opens
      setJourneySkills(null); // Reset journey skills when modal opens
      setJourneyMinExperienceLevel(null); // Reset journey experience level when modal opens
      if (legId) {
        // Editing existing leg - load journey data first to get journey skills, then load leg data
        // This ensures journeySkills state is set before leg data potentially overwrites it
        loadBoatCapacity(legId)
          .then((journeyExpLevel) => {
            // After journey data is loaded, load leg data
            // Pass journey experience level directly to ensure it's available
            loadLeg(journeyExpLevel);
          })
          .catch((error) => {
            logger.error('Error loading boat capacity', { error: error instanceof Error ? error.message : String(error) });
            // Still try to load leg data even if boat capacity load fails
            loadLeg(null);
          });
      } else {
        // Creating new leg - reset form first, then load journey defaults
        resetForm();
        // Check leg creation limit
        checkLegLimit();
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
    logger.debug('Risk level state changed', { riskLevel }, true);
  }, [riskLevel]);

  useEffect(() => {
    logger.debug('Skills state changed', { count: skills?.length || 0 }, true);
  }, [skills]);

  useEffect(() => {
    logger.debug('Journey skills state changed', { count: journeySkills?.length || 0 }, true);
  }, [journeySkills]);

  // Set journey defaults for existing legs that don't have values
  useEffect(() => {
    if (isOpen && legId && journeyDefaultsLoaded && !journeyDefaultsApplied && (!riskLevel || (skills.length === 0 && (!journeySkills || journeySkills.length === 0)))) {
      logger.debug('Leg loaded but missing values, applying journey defaults', {}, true);
      setJourneyDefaultsApplied(true);
      // Load journey data and apply defaults
      const applyDefaults = async () => {
        const supabase = getSupabaseBrowserClient();
        const { data: journeyData } = await supabase
          .from('journeys')
          .select('risk_level, skills')
          .eq('id', journeyId)
          .single();
        
        if (journeyData) {
          // Set risk level if missing
          if (!riskLevel) {
            // Handle both array (old format) and single value (new format) for backward compatibility
            const journeyRiskLevelRaw = (journeyData as any).risk_level;
            let defaultRiskLevel: RiskLevel | null = null;
            if (Array.isArray(journeyRiskLevelRaw) && journeyRiskLevelRaw.length > 0) {
              // Old format: array - take first element
              defaultRiskLevel = journeyRiskLevelRaw[0] as RiskLevel;
            } else if (typeof journeyRiskLevelRaw === 'string') {
              // New format: single value
              defaultRiskLevel = journeyRiskLevelRaw as RiskLevel;
            }
            if (defaultRiskLevel && ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].includes(defaultRiskLevel)) {
              logger.debug('Applying journey risk level', { defaultRiskLevel }, true);
              setRiskLevel(defaultRiskLevel);
            }
          }
          
          // Don't set skills if journey has them - they're read-only
          // Only set leg skills if journey doesn't have skills and leg doesn't have them
          // Note: journeySkillsData is already converted to display format in loadBoatCapacity
          const journeySkillsData = (journeyData as any).skills as string[] | null;
          if (skills.length === 0 && (!journeySkillsData || journeySkillsData.length === 0)) {
            // Neither journey nor leg has skills - this is fine, leg can have its own
            logger.debug('No skills at journey or leg level', {}, true);
          }
        }
      };
      applyDefaults();
    }
  }, [isOpen, legId, riskLevel, skills, journeyDefaultsLoaded, journeyDefaultsApplied, journeySkills, journeyId]);

  const loadBoatCapacity = async (currentLegId: string | null): Promise<ExperienceLevel | null> => {
    const supabase = getSupabaseBrowserClient();
    
    // Get journey's boat capacity, risk level, skills, and min_experience_level
    const { data: journeyData, error: journeyError } = await supabase
      .from('journeys')
      .select('boat_id, risk_level, skills, min_experience_level, boats(capacity)')
      .eq('id', journeyId)
      .single();

    if (journeyError) {
      logger.error('Error loading journey data', { error: journeyError instanceof Error ? journeyError.message : String(journeyError) });
      return null;
    }

    logger.debug('Journey data loaded', { hasJourneyData: !!journeyData }, true);
    logger.debug('Current legId parameter', { currentLegId }, true);
    logger.debug('Journey risk_level', { riskLevel: (journeyData as any)?.risk_level }, true);
    logger.debug('Journey skills', { count: (journeyData as any)?.skills?.length || 0 }, true);

    if (journeyData) {
      if ((journeyData as any).boats) {
        const capacity = (journeyData as any).boats.capacity;
        setBoatCapacity(capacity);
      }
      
      // Store journey skills (if any) - they will be shown as read-only
      // Convert from canonical format to display format for UI
      const journeySkillsData = (journeyData as any).skills as string[] | null;
      const hasJourneySkills = journeySkillsData && journeySkillsData.length > 0;
      const displayJourneySkills = hasJourneySkills 
        ? journeySkillsData.map(toDisplaySkillName)
        : null;
      logger.debug('Setting journeySkills state', { count: displayJourneySkills?.length || 0 }, true);
      setJourneySkills(displayJourneySkills);
      
      // Store journey min_experience_level (if any) - it will be shown as read-only
      const journeyExpLevel = (journeyData as any).min_experience_level as number | null;
      const hasJourneyExpLevel = journeyExpLevel !== null && journeyExpLevel !== undefined;
      logger.debug('Setting journeyMinExperienceLevel state', { level: hasJourneyExpLevel ? journeyExpLevel : null }, true);
      setJourneyMinExperienceLevel(hasJourneyExpLevel ? (journeyExpLevel as ExperienceLevel) : null);
      
      // Always check current state using functional updates to see if we need to set defaults
      // This works for both new legs and existing legs that don't have values
      setRiskLevel(currentRiskLevel => {
        setSkills(currentSkills => {
          setMinExperienceLevel(currentExpLevel => {
            const shouldSetRiskLevel = !currentRiskLevel;
            const shouldSetSkills = !currentSkills || currentSkills.length === 0;
            const shouldSetExpLevel = currentExpLevel === null;
            const shouldSetDefaults = !currentLegId || shouldSetRiskLevel || shouldSetSkills || shouldSetExpLevel;
            
            if (shouldSetDefaults) {
              logger.debug('Setting defaults from journey', { isNewLeg: !currentLegId, shouldSetRiskLevel, shouldSetSkills, shouldSetExpLevel }, true);
              
              // Set default risk level from journey (use first one if array) - only if not already set
              if (shouldSetRiskLevel) {
                // Handle both array (old format) and single value (new format) for backward compatibility
                const journeyRiskLevelRaw = (journeyData as any).risk_level;
                logger.debug('Journey risk level', { journeyRiskLevelRaw }, true);
                let defaultRiskLevel: RiskLevel | null = null;
                if (Array.isArray(journeyRiskLevelRaw) && journeyRiskLevelRaw.length > 0) {
                  // Old format: array - take first element
                  defaultRiskLevel = journeyRiskLevelRaw[0] as RiskLevel;
                } else if (typeof journeyRiskLevelRaw === 'string') {
                  // New format: single value
                  defaultRiskLevel = journeyRiskLevelRaw as RiskLevel;
                }
                if (defaultRiskLevel) {
                  logger.debug('Setting risk level to', { defaultRiskLevel }, true);
                  if (defaultRiskLevel && ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].includes(defaultRiskLevel)) {
                    logger.debug('Calling setRiskLevel with', { defaultRiskLevel }, true);
                    // Set risk level using setTimeout to avoid nested state updates
                    setTimeout(() => {
                      setRiskLevel(defaultRiskLevel);
                    }, 0);
                  } else {
                    logger.debug('Risk level validation failed', { defaultRiskLevel }, true);
                  }
                }
              }

              // Set default skills from journey - only if journey doesn't have skills defined
              // If journey has skills, they will be shown as read-only, so we don't set leg skills
              if (shouldSetSkills) {
                const journeySkillsData = (journeyData as any).skills as string[] | null;
                logger.debug('Journey skills (canonical)', { count: journeySkillsData?.length || 0 }, true);
                // Only set leg skills if journey doesn't have skills defined
                // If journey has skills, they are read-only and not stored in leg
                if (!journeySkillsData || journeySkillsData.length === 0) {
                  // Journey has no skills, so leg can have its own skills
                  logger.debug('Journey has no skills, leg can have its own', {}, true);
                  // Keep current (empty) skills
                } else {
                  // Journey has skills - they will be shown as read-only, don't store in leg
                  logger.debug('Journey has skills defined, they will be shown as read-only', {}, true);
                  // Don't store skills in leg when journey has them
                }
              }

              // Set default experience level from journey - only if not already set
              if (shouldSetExpLevel) {
                const journeyExpLevel = (journeyData as any).min_experience_level as number | null;
                logger.debug('Journey min_experience_level', { journeyExpLevel }, true);
                if (journeyExpLevel !== null && journeyExpLevel !== undefined) {
                  // Journey has experience level - set as default for leg
                  // Leg can later be set to same or more strict level
                  setTimeout(() => {
                    setMinExperienceLevel(journeyExpLevel as ExperienceLevel);
                  }, 0);
                } else {
                  // Journey has no experience level - leg can have its own
                  logger.debug('Journey has no experience level, leg can have its own', {}, true);
                }
              }
              
              return currentExpLevel;
            } else {
              logger.debug('Leg already has risk level, skills, and experience level, not setting defaults', {}, true);
              return currentExpLevel;
            }
          });
          
          return currentSkills;
        });
        
        return currentRiskLevel;
      });
      
      // Mark that defaults have been loaded
      setJourneyDefaultsLoaded(true);
      logger.debug('Journey defaults loaded flag set to true', {}, true);
      
      // Return journey experience level
      const journeyExpLevelReturn = (journeyData as any).min_experience_level as number | null;
      return journeyExpLevelReturn !== null && journeyExpLevelReturn !== undefined ? (journeyExpLevelReturn as ExperienceLevel) : null;
    }
    
    return null;
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
    // Reset riskLevel, skills, and experience level - they will be set from journey default in loadBoatCapacity
    setRiskLevel(null);
    setSkills([]);
    setJourneySkills(null);
    setMinExperienceLevel(null);
    setJourneyMinExperienceLevel(null);
  };

  const loadLeg = async (journeyExpLevel: ExperienceLevel | null = null) => {
    if (!legId) return;

    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    
    // Load leg data
    const { data: legData, error: legError } = await supabase
      .from('legs')
      .select('id, name, description, start_date, end_date, crew_needed, skills, risk_level, min_experience_level')
      .eq('id', legId)
      .eq('journey_id', journeyId)
      .single();

    if (legError) {
      logger.error('Error loading leg', { error: legError instanceof Error ? legError.message : String(legError) });
      setError('Failed to load leg');
      setLoading(false);
      return;
    }

    // Load waypoints from waypoints table using RPC function
    const { data: waypointsData, error: waypointsError } = await supabase
      .rpc('get_leg_waypoints', { leg_id_param: legId });

    let waypointsResult: Waypoint[] = [];
    
    if (waypointsError) {
      logger.error('Error loading waypoints via RPC', { error: waypointsError instanceof Error ? waypointsError.message : String(waypointsError) });
      // Fallback: if RPC doesn't exist yet, return empty array
      // The RPC function should be created by migration
      waypointsResult = [];
    } else if (waypointsData) {
      // Convert PostGIS GeoJSON to waypoint format
      waypointsResult = waypointsData.map((row: any) => {
        let coordinates: [number, number] = [0, 0];
        
        // Parse GeoJSON from PostGIS
        if (row.location) {
          if (typeof row.location === 'string') {
            try {
              const geoJson = JSON.parse(row.location);
              coordinates = geoJson.coordinates as [number, number];
            } catch (e) {
              logger.error('Error parsing location GeoJSON', { error: e instanceof Error ? e.message : String(e) });
            }
          } else if (row.location.coordinates) {
            coordinates = row.location.coordinates as [number, number];
          } else if (row.location.type === 'Point' && row.location.coordinates) {
            coordinates = row.location.coordinates as [number, number];
          }
        }

        return {
          index: row.index,
          geocode: {
            type: 'Point',
            coordinates: coordinates,
          },
          name: row.name || '',
        };
      });
    }

    if (legData) {
      setLegName(legData.name);
      setDescription(legData.description || '');
      setStartDate(legData.start_date ? new Date(legData.start_date).toISOString().split('T')[0] : '');
      setEndDate(legData.end_date ? new Date(legData.end_date).toISOString().split('T')[0] : '');
      setCrewNeeded(legData.crew_needed || '');
      // Convert skills from canonical format to display format for UI
      const displaySkills = (legData.skills || []).map(toDisplaySkillName);
      setSkills(displaySkills);
      setRiskLevel((legData.risk_level as RiskLevel) || null);
      // Set experience level: use leg's if set, otherwise use journey's (if available)
      // This ensures the UI shows the effective level even if leg doesn't have its own stored
      const legExpLevel = (legData.min_experience_level as ExperienceLevel | null) || null;
      // Use journeyExpLevel parameter if provided, otherwise fall back to state (which should be set by now)
      const effectiveJourneyLevel = journeyExpLevel !== null ? journeyExpLevel : journeyMinExperienceLevel;
      setMinExperienceLevel(legExpLevel || effectiveJourneyLevel);
      setWaypoints(waypointsResult);
      
      logger.debug('Leg loaded', { riskLevel: legData.risk_level, skillsCount: legData.skills?.length || 0, minExperienceLevel: legData.min_experience_level, effectiveJourneyLevel, waypointsCount: waypointsResult.length }, true);
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

    // Validate experience level: if journey has min_experience_level, leg level must be >= journey level
    if (journeyMinExperienceLevel !== null && minExperienceLevel !== null) {
      if (minExperienceLevel < journeyMinExperienceLevel) {
        const journeyLevelName = getExperienceLevelConfig(journeyMinExperienceLevel).displayName;
        const legLevelName = getExperienceLevelConfig(minExperienceLevel).displayName;
        setError(`Leg experience level (${legLevelName}) cannot be less strict than journey level (${journeyLevelName}). Leg level must be ${journeyLevelName} or higher.`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      // Validate waypoint coordinates
      for (const waypoint of waypoints) {
        const [lng, lat] = waypoint.geocode.coordinates;
        if (!validateCoordinates(lng, lat)) {
          throw new Error(`Invalid coordinates for waypoint "${waypoint.name}": lng=${lng}, lat=${lat}`);
        }
      }

      const legData: any = {
        journey_id: journeyId,
        name: legName.trim(),
        description: description.trim() || null,
        risk_level: riskLevel,
        updated_at: new Date().toISOString(),
      };
      
      // Normalize skills to canonical format (snake_case) for storage
      const { normalizeSkillNames } = require('@/app/lib/skillUtils');
      
      // Only save skills to leg if journey doesn't have skills defined
      // If journey has skills, they are read-only and not stored in leg table
      if (!journeySkills || journeySkills.length === 0) {
        legData.skills = normalizeSkillNames(skills); // Store in canonical format
      } else {
        // Journey has skills - don't save skills to leg, set to empty array
        legData.skills = [];
      }

      // Handle experience level: only save if leg has a more strict level than journey
      // If journey has min_experience_level, leg can have a higher (more strict) level
      // If leg level equals journey level, don't store it (use journey level)
      // If journey doesn't have min_experience_level, leg can have any level
      if (journeyMinExperienceLevel !== null) {
        // Journey has experience level - leg can only have higher (more strict) level
        if (minExperienceLevel !== null && minExperienceLevel > journeyMinExperienceLevel) {
          // Leg has more strict level - store it
          legData.min_experience_level = minExperienceLevel;
        } else {
          // Leg level equals journey level or is less strict - use journey level (don't store in leg)
          legData.min_experience_level = null; // Journey level applies, don't store in leg
        }
      } else {
        // Journey has no experience level - leg can have its own
        legData.min_experience_level = minExperienceLevel || null;
      }

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

      let savedLegId: string;

      if (legId) {
        // Update existing leg
        const { data: updatedLeg, error: updateError } = await supabase
          .from('legs')
          .update(legData)
          .eq('id', legId)
          .eq('journey_id', journeyId)
          .select('id')
          .single();

        if (updateError) {
          throw updateError;
        }

        savedLegId = updatedLeg.id;

        // Delete existing waypoints and insert new ones
        const { error: deleteError } = await supabase
          .from('waypoints')
          .delete()
          .eq('leg_id', savedLegId);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        // Create new leg
        const { data: newLeg, error: insertError } = await supabase
          .from('legs')
          .insert(legData)
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        savedLegId = newLeg.id;
      }

      // Insert waypoints using PostGIS ST_MakePoint
      // We need to use raw SQL for PostGIS functions
      const waypointInserts = waypoints.map(wp => {
        const [lng, lat] = wp.geocode.coordinates;
        return {
          leg_id: savedLegId,
          index: wp.index,
          name: wp.name || null,
          location: `SRID=4326;POINT(${lng} ${lat})`, // PostGIS WKT format
        };
      });

      // Insert waypoints - Supabase will handle the PostGIS conversion
      // We'll use a workaround: insert as text and let PostGIS cast it
      // Actually, we need to use RPC or raw query for PostGIS functions
      // Let's use a simpler approach: insert with raw SQL via RPC
      
      // For now, let's use Supabase's built-in support for PostGIS
      // We'll insert waypoints with location as a GeoJSON-like structure
      // Supabase PostgREST should handle the conversion
      
      const { error: waypointsError } = await supabase
        .from('waypoints')
        .insert(
          waypoints.map(wp => {
            const [lng, lat] = wp.geocode.coordinates;
            // Use PostGIS WKT format - Supabase should handle this
            return {
              leg_id: savedLegId,
              index: wp.index,
              name: wp.name || null,
              // We'll need to use a function to convert to PostGIS geometry
              // For now, try using the raw SQL approach via RPC
            };
          })
        );

      // Since Supabase client doesn't directly support PostGIS functions,
      // we need to use an RPC function or raw SQL
      // Let's create an RPC function to handle waypoint insertion
      
      // Alternative: Use Supabase's PostGIS support by calling an RPC function
      const { error: waypointsInsertError } = await supabase.rpc('insert_leg_waypoints', {
        leg_id_param: savedLegId,
        waypoints_param: waypoints.map(wp => ({
          index: wp.index,
          name: wp.name || null,
          lng: wp.geocode.coordinates[0],
          lat: wp.geocode.coordinates[1],
        })),
      });

      if (waypointsInsertError) {
        // If RPC doesn't exist, try direct insert with WKT
        // We'll need to create the RPC function first
        logger.warn('RPC function insert_leg_waypoints not found, using direct insert', {});
        
        // Direct insert approach - Supabase may not support PostGIS directly
        // We need to create an RPC function for this
        throw new Error('Waypoint insertion requires RPC function. Please create insert_leg_waypoints function.');
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      logger.error('Error saving leg', { error: err instanceof Error ? err.message : String(err) });
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
    // Don't allow modifying journey skills
    if (journeySkills && journeySkills.includes(skill)) {
      logger.debug('Cannot modify journey skill', { skill }, true);
      return;
    }
    
    // Only allow adding/removing leg-specific skills
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
        className="fixed inset-0 bg-black/50 z-50 flex justify-center pt-[5rem] px-4 pb-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[calc(100vh-5rem)] overflow-y-auto"
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
                    <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
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
                    <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
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
                    <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
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

                {/* Minimum Required Experience Level */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Minimum Experience Level
                    {journeyMinExperienceLevel !== null && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (Journey: {getExperienceLevelConfig(journeyMinExperienceLevel).displayName} - minimum)
                      </span>
                    )}
                  </label>
                  {journeyMinExperienceLevel !== null && (
                    <p className="text-xs text-muted-foreground mb-3">
                      You can set a more strict requirement for this leg (higher level):
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {getAllExperienceLevels().map((levelConfig) => {
                      const isJourneyLevel = journeyMinExperienceLevel === levelConfig.value;
                      const isLegSelected = minExperienceLevel === levelConfig.value;
                      // Journey level is always visually selected and disabled when journey has experience level
                      const isSelected = isJourneyLevel || isLegSelected;
                      const isDisabled = isJourneyLevel; // Journey level card is always disabled (read-only)
                      const canSelect = journeyMinExperienceLevel === null || levelConfig.value >= journeyMinExperienceLevel;
                      
                      return (
                        <label 
                           key={levelConfig.value}
                           className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors">
                        <input
                          className="mr-3 w-5 h-5"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isDisabled) return; // Can't unselect journey level
                            if (!canSelect) {
                              setError(`Leg experience level must be ${getExperienceLevelConfig(journeyMinExperienceLevel!).displayName} or higher`);
                              return;
                            }
                            // Toggle selection: if already selected (leg level) and not journey level, deselect
                            // If journey level, it stays selected (can't be unselected)
                            const newValue = isLegSelected && !isJourneyLevel ? null : levelConfig.value;
                            setMinExperienceLevel(newValue);
                          }}
                          disabled={isDisabled}
                          title={
                            isJourneyLevel
                              ? `Journey minimum (read-only) - ${levelConfig.displayName}`
                              : !canSelect
                                ? `Must be ${getExperienceLevelConfig(journeyMinExperienceLevel!).displayName} or higher`
                                : levelConfig.displayName
                          }
                        ></input>
                          <span className="text-sm text-foreground">{levelConfig.displayName}</span>  
                        </label>
                      );
                    })}
                  </div>
                  {minExperienceLevel !== null && minExperienceLevel === journeyMinExperienceLevel && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Same as journey level - will use journey requirement
                    </p>
                  )}
                  {minExperienceLevel !== null && journeyMinExperienceLevel !== null && minExperienceLevel > journeyMinExperienceLevel && (
                    <p className="text-xs text-primary mt-2">
                      More strict than journey - this leg requires {getExperienceLevelConfig(minExperienceLevel).displayName}
                    </p>
                  )}
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Required Skills
                    {journeySkills && journeySkills.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({journeySkills.length} from Journey - read-only)
                      </span>
                    )}
                    {skills.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({skills.length} leg-specific)
                      </span>
                    )}
                  </label>
                  {/* Debug: Show current skills state */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Debug - Journey skills: {JSON.stringify(journeySkills)}, Leg skills: {JSON.stringify(skills)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      // Extract all unique skill names from all categories
                      const allSkills = [
                        ...skillsConfig.general,
                      ];
                      // Convert snake_case to Title Case for display
                      const formatSkillName = (name: string) => {
                        return name
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      
                      // Merge journey skills (always present, read-only) with leg skills (editable)
                      // For display: show all skills that are either in journey OR in leg
                      const allDisplayedSkills = journeySkills && journeySkills.length > 0
                        ? [...new Set([...journeySkills, ...skills])] // Merge and deduplicate
                        : skills; // No journey skills, just show leg skills
                      
                      // Debug log
                      logger.debug('Rendering skills UI', { journeySkillsCount: journeySkills?.length || 0, legSkillsCount: skills?.length || 0, allDisplayedSkillsCount: allDisplayedSkills?.length || 0 }, true);
                      
                      return allSkills.map((skill) => {
                        const displayName = formatSkillName(skill.name);
                        const isJourneySkill = Boolean(journeySkills && journeySkills.includes(displayName));
                        const isLegSkill = skills.includes(displayName);
                        const isChecked = isJourneySkill || isLegSkill;
                        const isReadOnly = Boolean(isJourneySkill); // Journey skills are read-only
                        
                        return (
                          <label 
                            key={skill.name} 
                            className={`flex items-center min-h-[44px] cursor-pointer p-2 border border-border rounded-md hover:bg-accent transition-colors gap-2 ${isReadOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                if (!isReadOnly) {
                                  handleSkillChange(displayName, e.target.checked);
                                }
                              }}
                              className="rounded border-border disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className={`text-sm ${isReadOnly ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {displayName}
                            </span>
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
                    className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !legName.trim() || waypoints.length < 2 || (!legId && limitReached)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
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
