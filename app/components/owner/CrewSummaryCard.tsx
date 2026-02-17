'use client';

import Image from 'next/image';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { toDisplaySkillName } from '@/app/lib/skillUtils';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import { formatDate } from '@/app/lib/dateFormat';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

interface CrewSummaryCardProps {
  crew: {
    id: string;
    full_name: string | null;
    username: string | null;
    sailing_experience: number | null;
    skills: string[];
    risk_level: string[] | null;
    profile_image_url: string | null;
  } | null;
  registration: {
    created_at: string;
    status: string;
    auto_approved: boolean;
  };
  skillMatchPercentage: number | null;
  experienceLevelMatches: boolean | null;
  effectiveMinExperienceLevel: number | null;
  legSkills: string[];
}

const getRiskLevelBadgeConfig = (riskLevel: RiskLevel | null) => {
  if (!riskLevel) return null;

  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: '/coastal_sailing2.png',
        displayName: riskLevelsConfig.coastal_sailing.title,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300',
      };
    case 'Offshore sailing':
      return {
        icon: '/offshore_sailing2.png',
        displayName: riskLevelsConfig.offshore_sailing.title,
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        borderColor: 'border-purple-300',
      };
    case 'Extreme sailing':
      return {
        icon: '/extreme_sailing2.png',
        displayName: riskLevelsConfig.extreme_sailing.title,
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
      };
    default:
      return null;
  }
};

export function CrewSummaryCard({
  crew,
  registration,
  skillMatchPercentage,
  experienceLevelMatches,
  effectiveMinExperienceLevel,
  legSkills,
}: CrewSummaryCardProps) {
  if (!crew) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, string> = {
      'Pending approval': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Not approved': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return statusConfig[status] || statusConfig['Pending approval'];
  };

  const topSkills = crew.skills.slice(0, 3);
  const moreSkillsCount = crew.skills.length > 3 ? crew.skills.length - 3 : 0;

  const getSkillMatchColor = (percentage: number | null) => {
    if (percentage === null) return 'bg-gray-200';
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSkillMatchTextColor = (percentage: number | null) => {
    if (percentage === null) return 'text-gray-700';
    if (percentage >= 80) return 'text-green-700';
    if (percentage >= 60) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="bg-card rounded-lg shadow p-6 mb-6 border border-border">
      {/* Top Row: Avatar, Name, Status */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          {/* Crew Avatar */}
          <div className="relative w-16 h-16 flex-shrink-0">
            {crew.profile_image_url ? (
              <Image
                src={crew.profile_image_url}
                alt={crew.full_name || crew.username || 'Crew member'}
                fill
                className="object-cover rounded-full"
                sizes="64px"
              />
            ) : (
              <div className="w-full h-full bg-accent rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          {/* Name and Registration Date */}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">
              {crew.full_name || crew.username || 'Unknown Crew'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Registered {formatDate(registration.created_at)}
            </p>
          </div>
        </div>

        {/* Status Badge and Auto-Approved */}
        <div className="flex flex-col items-start sm:items-end gap-2">
          <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusBadge(registration.status)}`}>
            {registration.status}
          </span>
          {registration.auto_approved && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Auto-approved by AI
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-6" />

      {/* Crew Attributes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Experience Level */}
        {crew.sailing_experience !== null && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Experience Level</p>
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 flex-shrink-0">
                <Image
                  src={getExperienceLevelConfig(crew.sailing_experience as ExperienceLevel).icon}
                  alt={getExperienceLevelConfig(crew.sailing_experience as ExperienceLevel).displayName}
                  fill
                  className="object-contain"
                />
              </div>
              <p className="font-medium text-foreground">
                {getExperienceLevelConfig(crew.sailing_experience as ExperienceLevel).displayName}
              </p>
            </div>
          </div>
        )}

        {/* Risk Level Preferences */}
        {crew.risk_level && crew.risk_level.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Preferred Risk Levels</p>
            <div className="flex flex-wrap gap-2">
              {crew.risk_level.map((level) => {
                const config = getRiskLevelBadgeConfig(level as RiskLevel);
                if (!config) return null;
                return (
                  <span
                    key={level}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
                  >
                    {level}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Skill Match */}
        {skillMatchPercentage !== null && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Skill Match</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getSkillMatchColor(skillMatchPercentage)}`}
                    style={{ width: `${skillMatchPercentage}%` }}
                  />
                </div>
              </div>
              <span className={`text-sm font-bold whitespace-nowrap ${getSkillMatchTextColor(skillMatchPercentage)}`}>
                {skillMatchPercentage}%
              </span>
            </div>
            {legSkills.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {crew.skills.filter(s => legSkills.includes(s)).length}/{legSkills.length} skills match
              </p>
            )}
          </div>
        )}

        {/* Top Skills */}
        {crew.skills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Top Skills</p>
            <div className="flex flex-wrap gap-2">
              {topSkills.map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs border border-border"
                >
                  {toDisplaySkillName(skill)}
                </span>
              ))}
              {moreSkillsCount > 0 && (
                <span className="px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs border border-border font-medium">
                  +{moreSkillsCount} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
