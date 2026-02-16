'use client';

/**
 * CrewCard Component
 * 
 * Displays a crew member's profile in a card format.
 * Supports privacy controls - shows anonymized data for unauthenticated users.
 */

import React from 'react';
import { User, MapPin, Award, Shield } from 'lucide-react';
import experienceLevelsConfig from '@/app/config/experience-levels-config.json';

interface CrewCardProps {
  id: string;
  name: string | null; // Null for unauthenticated viewers
  image_url: string | null; // Null for unauthenticated viewers
  experience_level: number; // 1-4
  risk_levels: string[]; // ["Coastal sailing", "Offshore sailing", "Extreme sailing"]
  skills: string[]; // Array of skill names
  location: string;
  matchScore: number; // 0-100
  availability?: string;
  onClick?: (crewId: string) => void;
}

/**
 * Get experience level display info
 */
function getExperienceLevelInfo(level: number) {
  const config = experienceLevelsConfig.levels.find(l => l.value === level);
  return {
    displayName: config?.displayName || 'Unknown',
    icon: config?.icon || '/Beginner',
  };
}

/**
 * Get risk level badge color
 */
function getRiskLevelColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'Coastal sailing':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'Offshore sailing':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Extreme sailing':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Get match score color
 */
function getMatchScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 border-green-300';
  if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-orange-100 text-orange-800 border-orange-300';
}

/**
 * Format skill name for display
 */
function formatSkillName(skill: string): string {
  return skill
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function CrewCard({
  id,
  name,
  image_url,
  experience_level,
  risk_levels,
  skills,
  location,
  matchScore,
  availability,
  onClick,
}: CrewCardProps) {
  const experienceInfo = getExperienceLevelInfo(experience_level);
  const isAnonymous = !name; // Anonymous if no name (unauthenticated viewer)
  
  // Show top 3-4 skills only
  const displaySkills = skills.slice(0, 4);
  
  return (
    <div
      className={`
        relative flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm
        transition-all duration-200 hover:shadow-md hover:border-primary-300
        ${onClick ? 'cursor-pointer' : ''}
        min-w-[280px] max-w-[320px]
      `}
      onClick={() => onClick?.(id)}
    >
      {/* Match Score Badge */}
      <div className="absolute top-3 right-3 z-10">
        <div
          className={`
            px-2 py-1 rounded-full text-xs font-semibold border
            ${getMatchScoreColor(matchScore)}
          `}
        >
          {matchScore}% match
        </div>
      </div>

      {/* Header: Image & Name */}
      <div className="flex items-center gap-3 p-4 pb-3">
        {/* Profile Image or Placeholder */}
        <div className="relative flex-shrink-0">
          {image_url && !isAnonymous ? (
            <img
              src={image_url}
              alt={name || 'Crew member'}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
              <User className="w-8 h-8 text-gray-500" />
            </div>
          )}
        </div>

        {/* Name & Location */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {isAnonymous ? 'Crew Member' : name}
          </h3>
          <div className="flex items-center gap-1 text-sm text-gray-600 mt-0.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>
      </div>

      {/* Experience Level */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 text-sm">
          <Award className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-gray-700">
            {experience_level}. {experienceInfo.displayName}
          </span>
        </div>
      </div>

      {/* Risk Levels */}
      {risk_levels.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {risk_levels.map((level) => (
                <span
                  key={level}
                  className={`
                    px-2 py-0.5 rounded-full text-xs font-medium border
                    ${getRiskLevelColor(level)}
                  `}
                >
                  {level.replace(' sailing', '')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {displaySkills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200"
              >
                {formatSkillName(skill)}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded border border-gray-200">
                +{skills.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Availability */}
      {availability && (
        <div className="px-4 pb-3 text-sm text-gray-600">
          <span className="font-medium">Available:</span> {availability}
        </div>
      )}

      {/* Privacy Notice for Anonymous Users */}
      {isAnonymous && (
        <div className="mt-auto border-t border-gray-100 bg-gray-50 px-4 py-2.5 rounded-b-lg">
          <p className="text-xs text-gray-600 text-center">
            Sign up to see full profile details
          </p>
        </div>
      )}
    </div>
  );
}
