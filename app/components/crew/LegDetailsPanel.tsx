'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';
import { RegistrationRequirementsForm } from '@/app/components/crew/RegistrationRequirementsForm';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type Leg = {
  leg_id: string;
  leg_name: string;
  leg_description: string | null;
  journey_id: string;
  journey_name: string;
  start_date: string | null;
  end_date: string | null;
  crew_needed: number | null;
  risk_level: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  skills: string[];
  boat_id: string;
  boat_name: string;
  boat_type: string | null;
  boat_image_url: string | null;
  boat_average_speed_knots: number | null;
  skipper_name: string | null;
  min_experience_level: number | null;
  skill_match_percentage?: number;
  experience_level_matches?: boolean;
  start_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
  end_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
};

type LegDetailsPanelProps = {
  leg: Leg;
  isOpen: boolean;
  onClose: () => void;
  userSkills?: string[]; // User's skills for matching display
  userExperienceLevel?: number | null; // User's experience level for matching display
  onRegistrationChange?: () => void; // Callback when registration status changes
};

export function LegDetailsPanel({ leg, isOpen, onClose, userSkills = [], userExperienceLevel = null, onRegistrationChange }: LegDetailsPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  // Calculate distance between start and end waypoints (nautical miles)
  const calculateDistance = (): number | null => {
    if (!leg.start_waypoint || !leg.end_waypoint) return null;

    const R = 3440; // Earth's radius in nautical miles
    const lat1 = (leg.start_waypoint.lat * Math.PI) / 180;
    const lat2 = (leg.end_waypoint.lat * Math.PI) / 180;
    const deltaLat = ((leg.end_waypoint.lat - leg.start_waypoint.lat) * Math.PI) / 180;
    const deltaLng = ((leg.end_waypoint.lng - leg.start_waypoint.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const distance = calculateDistance();

  // Calculate duration in hours based on distance and speed (matching owner page calculation)
  const calculateDuration = (): { hours: number | null; formatted: string } => {
    // Ensure boat speed is a valid number
    const boatSpeed = typeof leg.boat_average_speed_knots === 'string' 
      ? parseFloat(leg.boat_average_speed_knots) 
      : leg.boat_average_speed_knots;
    
    if (!distance || !boatSpeed || boatSpeed <= 0 || isNaN(boatSpeed)) {
      return { hours: null, formatted: 'N/A' };
    }
    
    // Account for 70-80% efficiency due to conditions (same as owner page)
    const effectiveSpeed = boatSpeed * 0.75;
    const hours = distance / effectiveSpeed;
    
    // Format duration as human-readable string (same as owner page)
    if (hours < 24) {
      return { hours, formatted: `${Math.round(hours)}h` };
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return { hours, formatted: `${days}d` };
    }
    return { hours, formatted: `${days}d ${remainingHours}h` };
  };

  const duration = calculateDuration();

  // Get risk level color
  const getRiskLevelColor = (riskLevel: string | null): string => {
    switch (riskLevel) {
      case 'Coastal sailing':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Offshore sailing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Extreme sailing':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const { user } = useAuth();
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showRequirementsForm, setShowRequirementsForm] = useState(false);
  const [registrationNotes, setRegistrationNotes] = useState('');
  const [requirementsAnswers, setRequirementsAnswers] = useState<any[]>([]);
  const [hasRequirements, setHasRequirements] = useState(false);

  // Load registration status when leg changes
  useEffect(() => {
    if (!user || !leg.leg_id) {
      setRegistrationStatus(null);
      return;
    }

    const loadRegistrationStatus = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('registrations')
        .select('status')
        .eq('leg_id', leg.leg_id)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading registration status:', error);
        return;
      }

      setRegistrationStatus(data?.status || null);
    };

    loadRegistrationStatus();
  }, [user, leg.leg_id]);

  // Check if journey has requirements when register button is clicked
  const checkRequirements = async () => {
    try {
      const response = await fetch(`/api/journeys/${leg.journey_id}/requirements`);
      if (response.ok) {
        const data = await response.json();
        const reqs = data.requirements || [];
        setHasRequirements(reqs.length > 0);
        if (reqs.length > 0) {
          // Has requirements - show requirements form directly (no modal)
          setShowRequirementsForm(true);
          setShowRegistrationModal(false);
        } else {
          // No requirements - show regular registration modal
          setShowRequirementsForm(false);
          setShowRegistrationModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking requirements:', error);
      setHasRequirements(false);
      setShowRequirementsForm(false);
      // On error, show regular registration modal
      setShowRegistrationModal(true);
    }
  };

  // Handle register button click
  const handleRegister = async () => {
    setRegistrationError(null);
    setRegistrationNotes('');
    setRequirementsAnswers([]);
    // Check requirements first
    await checkRequirements();
  };

  // Handle requirements form completion - now includes notes and submits directly
  const handleRequirementsComplete = async (answers: any[], notes: string) => {
    setRequirementsAnswers(answers);
    setRegistrationNotes(notes);
    // Submit registration directly from requirements form
    await handleSubmitRegistration();
  };

  // Submit registration
  const handleSubmitRegistration = async () => {
    if (!user) {
      setRegistrationError('You must be logged in to register');
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leg_id: leg.leg_id,
          notes: registrationNotes.trim() || null,
          answers: requirementsAnswers.length > 0 ? requirementsAnswers : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      // Update local state
      setRegistrationStatus(data.registration.status);
      setShowRegistrationModal(false);
      setShowRequirementsForm(false);
      setRegistrationNotes('');
      setRequirementsAnswers([]);
      
      // Notify parent component
      onRegistrationChange?.();

      // Show success message
      if (data.registration.status === 'Approved' && data.registration.auto_approved) {
        alert('Congratulations! You\'ve been automatically approved for this leg!');
      } else {
        console.log('Registration successful:', data.message);
      }
    } catch (error: any) {
      setRegistrationError(error.message || 'An error occurred while registering');
      console.error('Registration error:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  // Cancel registration (set to Cancelled)
  const handleCancelRegistration = async () => {
    if (!user || !registrationStatus) return;

    if (!confirm('Are you sure you want to cancel your registration?')) {
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: registration } = await supabase
        .from('registrations')
        .select('id')
        .eq('leg_id', leg.leg_id)
        .eq('user_id', user.id)
        .single();

      if (!registration) {
        throw new Error('Registration not found');
      }

      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id);

      if (updateError) {
        throw updateError;
      }

      setRegistrationStatus('Cancelled');
      onRegistrationChange?.();
    } catch (error: any) {
      setRegistrationError(error.message || 'Failed to cancel registration');
      console.error('Cancel registration error:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Pending approval': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Not approved': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${statusConfig[status as keyof typeof statusConfig] || statusConfig['Pending approval']}`}>
        {status}
      </span>
    );
  };

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Reset minimized state when panel closes
      setIsMinimized(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Panel - Left Side - Overlays the map */}
      <div
        className={`fixed top-16 left-0 bottom-0 bg-card border-r border-border shadow-2xl z-50 transition-all duration-300 ease-out ${
          isOpen 
            ? isMinimized 
              ? 'w-0' 
              : 'w-full md:w-[400px] translate-x-0'
            : '-translate-x-full w-0'
        }`}
      >
        {/* Minimize/Maximize button - Inside Pane */}
        {isOpen && !isMinimized && (
          <button
            onClick={() => setIsMinimized(true)}
            className="absolute top-4 right-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all"
            title="Minimize panel"
            aria-label="Minimize panel"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Maximize button when minimized */}
        {isOpen && isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="absolute top-4 left-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all"
            title="Maximize panel"
            aria-label="Maximize panel"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Content */}
        {!isMinimized && (
          <div className="overflow-y-auto h-full">
            {/* Requirements Form - In pane */}
            {showRequirementsForm ? (
              <div className="p-6">
                <RegistrationRequirementsForm
                  journeyId={leg.journey_id}
                  legName={leg.leg_name}
                  onComplete={handleRequirementsComplete}
                  onCancel={() => {
                    setShowRequirementsForm(false);
                    setRegistrationNotes('');
                    setRequirementsAnswers([]);
                    setRegistrationError(null);
                  }}
                  isRegistering={isRegistering}
                  registrationError={registrationError}
                />
              </div>
            ) : showRegistrationModal ? (
              /* Registration Form - In pane */
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Register for Leg</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Register your interest to join this leg: <span className="font-medium text-foreground">{leg.leg_name}</span>
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={registrationNotes}
                    onChange={(e) => setRegistrationNotes(e.target.value)}
                    placeholder="Tell the owner why you're interested in this leg..."
                    className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {registrationNotes.length}/500 characters
                  </p>
                </div>

                {registrationError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {registrationError}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegistrationModal(false);
                      setRegistrationNotes('');
                      setRequirementsAnswers([]);
                      setRegistrationError(null);
                    }}
                    disabled={isRegistering}
                    className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRegistration}
                    disabled={isRegistering}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isRegistering ? 'Registering...' : 'Submit Registration'}
                  </button>
                </div>
              </div>
            ) : (
              /* Leg Details Content */
              <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">{leg.leg_name}</h2>
              <p className="text-muted-foreground">{leg.journey_name}</p>
            </div>

            {/* Description */}
            {leg.leg_description && (
              <div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{leg.leg_description}</p>
              </div>
            )}

            {/* Start and End Points with Arrow */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4">
              {/* Start Point */}
              <div className="flex flex-col justify-center">
                {leg.start_waypoint ? (
                  <div className="text-xs text-foreground leading-tight">
                    <div className="font-semibold">
                      {(() => {
                        const name = leg.start_waypoint.name || 'Unknown location';
                        if (!name || name === 'Unknown location') {
                          return name;
                        }
                        const parts = name.split(',').map(part => part.trim());
                        if (parts.length >= 2) {
                          const city = parts[0];
                          const country = parts.slice(1).join(', ');
                          return (
                            <>
                              {city}
                              {country && <span className="font-normal">, {country}</span>}
                            </>
                          );
                        }
                        return name;
                      })()}
                    </div>
                    {leg.start_date && (
                      <div className="text-xs font-medium text-foreground">
                        {formatDate(leg.start_date)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No start point</div>
                )}
              </div>

              {/* Arrow */}
              <div className="text-foreground flex items-center justify-center flex-shrink-0">
                <span className="text-lg">→</span>
              </div>

              {/* End Point */}
              <div className="flex flex-col justify-center">
                {leg.end_waypoint ? (
                  <div className="text-xs text-foreground leading-tight">
                    <div className="font-semibold">
                      {(() => {
                        const name = leg.end_waypoint.name || 'Unknown location';
                        if (!name || name === 'Unknown location') {
                          return name;
                        }
                        const parts = name.split(',').map(part => part.trim());
                        if (parts.length >= 2) {
                          const city = parts[0];
                          const country = parts.slice(1).join(', ');
                          return (
                            <>
                              {city}
                              {country && <span className="font-normal">, {country}</span>}
                            </>
                          );
                        }
                        return name;
                      })()}
                    </div>
                    {leg.end_date && (
                      <div className="text-xs font-medium text-foreground">
                        {formatDate(leg.end_date)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No end point</div>
                )}
              </div>
            </div>

            {/* Duration and Distance */}
            {distance !== null && (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 pt-3">
                {leg.boat_average_speed_knots && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Duration</div>
                    <div className="text-sm font-medium text-foreground">
                      {duration.formatted}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round(distance)}nm @ {typeof leg.boat_average_speed_knots === 'string' ? parseFloat(leg.boat_average_speed_knots) : leg.boat_average_speed_knots}kt)
                      </span>
                    </div>
                  </div>
                )}
                {/* Empty spacer to align with arrow column */}
                {leg.boat_average_speed_knots && <div></div>}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Distance</div>
                  <div className="text-sm font-medium text-foreground">
                    {Math.round(distance)} nm
                  </div>
                </div>
              </div>
            )}

            {/* Risk Level */}
            {leg.risk_level && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Risk Level</h3>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getRiskLevelColor(
                    leg.risk_level
                  )}`}
                >
                  {leg.risk_level}
                </span>
              </div>
            )}

            {/* Minimum Required Experience Level */}
            {leg.min_experience_level && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Minimum Experience Level</h3>
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  leg.experience_level_matches === false 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-transparent border-transparent'
                }`}>
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                      src={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).icon}
                      alt={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">
                      {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).description}
                    </p>
                    {leg.experience_level_matches === false && userExperienceLevel !== null && (
                      <p className="text-sm text-red-700 font-medium mt-1">
                        ⚠ Your level ({getExperienceLevelConfig(userExperienceLevel as ExperienceLevel).displayName}) is below the requirement
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Skills */}
            <SkillsMatchingDisplay
              legSkills={leg.skills || []}
              userSkills={userSkills}
              skillMatchPercentage={leg.skill_match_percentage}
            />

            {/* Boat Info */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">Boat & Skipper</h3>
              <div className="flex gap-3">
                {leg.boat_image_url && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={leg.boat_image_url}
                      alt={leg.boat_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{leg.boat_name}</h4>
                  {leg.boat_type && (
                    <p className="text-xs text-muted-foreground mb-1">{leg.boat_type}</p>
                  )}
                  {leg.skipper_name && (
                    <p className="text-xs text-muted-foreground">
                      Skipper: <span className="text-foreground">{leg.skipper_name}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Registration Section */}
            <div className="pt-4 border-t border-border">
              {registrationStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Registration Status:</span>
                    {getStatusBadge(registrationStatus)}
                  </div>
                  {registrationStatus === 'Pending approval' && (
                    <button
                      onClick={handleCancelRegistration}
                      disabled={isRegistering}
                      className="w-full bg-secondary text-secondary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Cancel Registration
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isRegistering ? 'Registering...' : 'Register for leg'}
                </button>
              )}
              {registrationError && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {registrationError}
                </div>
              )}
            </div>
            </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
