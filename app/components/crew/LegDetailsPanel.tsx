'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { MatchBadge } from '@/app/components/ui/MatchBadge';
import { getMatchingAndMissingSkills } from '@/app/lib/skillMatching';

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
};

export function LegDetailsPanel({ leg, isOpen, onClose, userSkills = [], userExperienceLevel = null }: LegDetailsPanelProps) {
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

  // Handle register button click (placeholder for now)
  const handleRegister = () => {
    // TODO: Implement registration flow in Phase 4
    console.log('Register for leg:', leg.leg_id);
    alert('Registration feature coming soon!');
  };

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Panel - Left Side */}
      <div
        className={`fixed top-0 left-0 bottom-0 bg-card border-r border-border shadow-2xl z-50 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '400px', maxWidth: '90vw' }}
      >

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="overflow-y-auto h-full">
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
            {leg.skills && leg.skills.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">Required Skills</h3>
                  {leg.skill_match_percentage !== undefined && userSkills.length > 0 && (
                    <MatchBadge percentage={leg.skill_match_percentage} size="sm" />
                  )}
                </div>
                
                {/* Show matching/missing breakdown if user has skills */}
                {userSkills.length > 0 && leg.skill_match_percentage !== undefined ? (
                  <div className="space-y-2">
                    {(() => {
                      const { matching, missing } = getMatchingAndMissingSkills(userSkills, leg.skills);
                      return (
                        <>
                          {matching.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">✓ You have ({matching.length}/{leg.skills.length}):</p>
                              <div className="flex flex-wrap gap-2">
                                {matching.map((skill, index) => (
                                  <span
                                    key={`match-${index}`}
                                    className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs border border-green-300"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {missing.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-orange-700 mb-1">⚠ Missing ({missing.length}/{leg.skills.length}):</p>
                              <div className="flex flex-wrap gap-2">
                                {missing.map((skill, index) => (
                                  <span
                                    key={`missing-${index}`}
                                    className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs border border-orange-300"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  /* If user has no skills, show all required skills */
                  <div className="flex flex-wrap gap-2">
                    {leg.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs border"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

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

            {/* Register Button */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleRegister}
                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Register Interest
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
