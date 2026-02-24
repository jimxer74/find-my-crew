'use client';

/**
 * CrewCard Component
 *
 * Displays a crew member's profile in a card format.
 * Supports privacy controls - shows anonymized data for unauthenticated users.
 * Refactored to use core Card component.
 */

import React, { useState } from 'react';
import { Card } from '@/app/components/ui';
import { User, MapPin, Award, Shield, Check, AlertCircle, ChevronDown } from 'lucide-react';
import experienceLevelsConfig from '@/app/config/experience-levels-config.json';
import { getMatchingAndMissingSkills } from '@/app/lib/skillMatching';

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
  requiredSkills?: string[]; // Skills searched for - shows matched/missing if provided
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
  requiredSkills,
  onClick,
}: CrewCardProps) {
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const experienceInfo = getExperienceLevelInfo(experience_level);
  const isAnonymous = !name; // Anonymous if no name (unauthenticated viewer)

  // Show top 3-4 skills only when collapsed
  const displaySkills = skills.slice(0, 4);
  
  return (
    <Card
      className={`
        relative flex flex-col flex-grow transition-all duration-200 hover:shadow-md
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

      {/* Skills - Collapsible */}
      {skills.length > 0 && (
        <div className="px-4 pb-3 border-t border-gray-100">
          {/* Collapsible Header */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSkillsExpanded(!skillsExpanded);
            }}
            className="w-full flex items-center justify-between py-2 hover:bg-gray-50 rounded transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">
              {skills.length} {skills.length === 1 ? 'Skill' : 'Skills'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform ${
                skillsExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Expanded Skills Content */}
          {skillsExpanded && (
            <div className="space-y-2 mt-2 pt-2">
              {requiredSkills && requiredSkills.length > 0 ? (
                // Show matched vs missing skills when search criteria provided
                (() => {
                  const { matching, missing } = getMatchingAndMissingSkills(
                    skills,
                    requiredSkills
                  );
                  return (
                    <>
                      {/* Matched Skills */}
                      {matching.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {matching.map((skill) => (
                            <span
                              key={`matched-${skill}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-300/80 text-green-800 text-xs font-medium rounded border border-green-500"
                            >
                              <Check className="w-3 h-3" />
                              {formatSkillName(skill)}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Missing Skills */}
                      {missing.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {missing.map((skill) => (
                            <span
                              key={`missing-${skill}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-300/80 text-orange-800 text-xs font-medium rounded border border-orange-600"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {formatSkillName(skill)}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()
              ) : (
                // Show all skills when no search criteria
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200"
                    >
                      {formatSkillName(skill)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Availability */}
      {availability && (
        <div className="px-4 pb-3 text-sm text-gray-600">
          <span className="font-medium">Available:</span> {availability}
        </div>
      )}
    </Card>
  );
}
