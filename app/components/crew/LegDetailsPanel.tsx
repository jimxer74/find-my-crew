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

  // Calculate duration in days
  const calculateDuration = (): number | null => {
    if (!leg.start_date || !leg.end_date) return null;
    const start = new Date(leg.start_date);
    const end = new Date(leg.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
                <p className="text-foreground whitespace-pre-wrap">{leg.leg_description}</p>
              </div>
            )}

            {/* Journey Info */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Location */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Start</h3>
                <p className="text-foreground">
                  {leg.start_waypoint?.name || 'Unknown location'}
                </p>
                {leg.start_date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(leg.start_date)}
                  </p>
                )}
              </div>

              {/* End Location */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">End</h3>
                <p className="text-foreground">
                  {leg.end_waypoint?.name || 'Unknown location'}
                </p>
                {leg.end_date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(leg.end_date)}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              {distance !== null && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Distance</h3>
                  <p className="text-lg font-semibold text-foreground">
                    {distance.toFixed(0)} <span className="text-sm font-normal">nm</span>
                  </p>
                </div>
              )}
              {duration !== null && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Duration</h3>
                  <p className="text-lg font-semibold text-foreground">
                    {duration} <span className="text-sm font-normal">day{duration !== 1 ? 's' : ''}</span>
                  </p>
                </div>
              )}
              {leg.crew_needed !== null && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Crew Needed</h3>
                  <p className="text-lg font-semibold text-foreground">{leg.crew_needed}</p>
                </div>
              )}
            </div>

            {/* Risk Level */}
            {leg.risk_level && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Risk Level</h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getRiskLevelColor(
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Required Skills</h3>
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
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Boat & Skipper</h3>
              <div className="flex gap-4">
                {leg.boat_image_url && (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={leg.boat_image_url}
                      alt={leg.boat_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground mb-1">{leg.boat_name}</h4>
                  {leg.boat_type && (
                    <p className="text-sm text-muted-foreground mb-2">{leg.boat_type}</p>
                  )}
                  {leg.skipper_name && (
                    <p className="text-sm text-muted-foreground">
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
