'use client';

import { logger } from '@/app/lib/logger';
import Image from 'next/image';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { toDisplaySkillName } from '@/app/lib/skillUtils';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import skillsConfig from '@/app/config/skills-config.json';
import { formatDate } from '@/app/lib/dateFormat';
import { useTheme } from '@/app/contexts/ThemeContext';
import { Card } from '@/app/components/ui/Card/Card';
import { Button } from '@/app/components/ui/Button/Button';
import { Badge } from '@/app/components/ui/Badge/Badge';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

interface CrewSummaryCardProps {
  crew: {
    id: string;
    full_name: string | null;
    username: string | null;
    sailing_experience: number | null;
    skills: Array<{ name: string; description: string }>;
    risk_level: string[] | null;
    profile_image_url: string | null;
    sailing_preferences: string | null;
    user_description: string | null;
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
  effectiveRiskLevel?: RiskLevel | null;
  riskLevelMatches?: boolean | null;
  onApprove?: () => void;
  onDeny?: () => void;
  isUpdating?: boolean;
}

const getRiskLevelConfig = (riskLevel: RiskLevel | null, theme: any) => {
  if (!riskLevel) return null;

  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: theme?.resolvedTheme === 'dark' ? '/coastal_sailing_dark.png' : '/coastal_sailing.png',
        displayName: riskLevelsConfig.coastal_sailing.title,
      };
    case 'Offshore sailing':
      return {
        icon: theme?.resolvedTheme === 'dark' ? '/offshore_sailing_dark.png' : '/offshore_sailing.png',
        displayName: riskLevelsConfig.offshore_sailing.title,
      };
    case 'Extreme sailing':
      return {
        icon: theme?.resolvedTheme === 'dark' ? '/extreme_sailing_dark.png' : '/extreme_sailing.png',
        displayName: riskLevelsConfig.extreme_sailing.title,
      };
    default:
      return null;
  }
};

const getSkillDescription = (skillName: string) => {
  // Iterate through all skill categories to find the skill
  for (const category of Object.values(skillsConfig)) {
    if (Array.isArray(category)) {
      const skill = category.find((s: any) => s.name === skillName);
      if (skill) {
        return skill.infoText;
      }
    }
  }
  return null;
};

export function CrewSummaryCard({
  crew,
  registration,
  skillMatchPercentage,
  experienceLevelMatches,
  effectiveMinExperienceLevel,
  legSkills,
  effectiveRiskLevel,
  riskLevelMatches,
  onApprove,
  onDeny,
  isUpdating,
}: CrewSummaryCardProps) {
  const theme = useTheme();
  if (!crew) return null;

  // Debug logging
  logger.debug('CrewSummaryCard received crew:', { crew });
  logger.debug('CrewSummaryCard crew.skills:', { skills: crew.skills });
  logger.debug('CrewSummaryCard crew.skills is array?', { isArray: Array.isArray(crew.skills) });
  logger.debug('CrewSummaryCard crew.skills length:', { length: crew.skills?.length });

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

  return (
    <Card className="mb-6">
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

        {/* Action Buttons or Status Badge */}
        <div className="flex flex-col items-start sm:items-end gap-2">
          {registration.status === 'Pending approval' ? (
            <div className="flex gap-2">
              <Button
                onClick={onApprove}
                disabled={isUpdating}
                variant="primary"
                size="sm"
              >
                {isUpdating ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                onClick={onDeny}
                disabled={isUpdating}
                variant="destructive"
                size="sm"
              >
                {isUpdating ? 'Denying...' : 'Deny'}
              </Button>
            </div>
          ) : (
            <Badge variant={
              registration.status === 'Approved' ? 'success' :
              registration.status === 'Not approved' ? 'error' :
              registration.status === 'Cancelled' ? 'secondary' :
              'warning'
            }>
              {registration.status}
            </Badge>
          )}
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

      {/* User Description Section */}
      {crew.user_description && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">About</p>
          <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3 border border-border">
            {crew.user_description}
          </p>
        </div>
      )}

      {/* Sailing Preferences Section */}
      {crew.sailing_preferences && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Sailing Preferences</p>
          <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3 border border-border">
            {crew.sailing_preferences}
          </p>
        </div>
      )}

      {/* Risk and Experience Level - LegDetailsPanel Style */}
      <div className="flex items-center justify-between mb-3 pb-3">
        <h3 className="text-xs font-semibold text-muted-foreground">Risk and Experience Level</h3>
      </div>
      <div className="space-y-3 grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-3 mb-6">
        {/* Risk Level */}
        {effectiveRiskLevel && (() => {
          const riskConfig = getRiskLevelConfig(effectiveRiskLevel, theme);
          return riskConfig ? (
            <div>
              <div className={`flex items-center gap-3 p-2 rounded-lg border-2 text-left ${
                riskLevelMatches === false
                  ? 'border-orange-300'
                  : 'border-green-500'
              }`}>
                <div className="relative w-12 h-12 flex-shrink-0">
                  <Image
                    src={riskConfig.icon}
                    alt={riskConfig.displayName}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-medium font-semibold">
                    {riskConfig.displayName}
                  </p>
                </div>
              </div>
              {riskLevelMatches === false && (
                <p className="text-xs text-orange-500 mt-1 text-left">
                  ⚠ Crew risk level preferences do not match requirement
                </p>
              )}
              {riskLevelMatches === true && (
                <p className="text-xs text-green-700 mt-1 text-left">
                  ✓ Crew risk level preferences match requirement
                </p>
              )}
            </div>
          ) : null;
        })()}

        {/* Experience Level */}
        {crew.sailing_experience !== null && (
          <div>
            <div className={`flex items-center gap-3 p-2 rounded-lg border-2 text-left ${
              experienceLevelMatches === false
                ? 'border-orange-300'
                : 'border-green-500'
            }`}>
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  src={
                    getExperienceLevelConfig(crew.sailing_experience as ExperienceLevel).icon +
                    (theme?.resolvedTheme === 'dark' ? '_dark.png' : '.png')
                  }
                  alt={getExperienceLevelConfig(crew.sailing_experience as ExperienceLevel).displayName}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-medium font-semibold">
                  {getExperienceLevelConfig(crew.sailing_experience as ExperienceLevel).displayName}
                </p>
              </div>
            </div>
            {experienceLevelMatches === false && (
              <p className="text-xs text-orange-500 mt-1 text-left">
                ⚠ Crew experience level is below requirement
              </p>
            )}
            {experienceLevelMatches === true && (
              <p className="text-xs text-green-700 mt-1 text-left">
                ✓ Crew experience level matches requirement
              </p>
            )}
          </div>
        )}
      </div>

      {/* Skill Match Section */}
      {skillMatchPercentage !== null && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Skill Match</p>
          <div className="flex items-center gap-3 p-2 rounded-lg border-2 border-border bg-muted/30">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Match Score</span>
                <span
                  className={`inline-flex items-center font-semibold text-xs px-2 py-0.5 rounded-full border-2 ${
                    skillMatchPercentage >= 80 ? 'bg-green-300/80 border-green-500 text-green-800' :
                    skillMatchPercentage >= 50 ? 'bg-yellow-300/80 border-yellow-600 text-yellow-800' :
                    skillMatchPercentage >= 25 ? 'bg-orange-300/80 border-orange-600 text-orange-800' :
                    'bg-red-500/80 border-red-600 text-red-800'
                  }`}
                >
                  {skillMatchPercentage}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getSkillMatchColor(skillMatchPercentage)}`}
                  style={{ width: `${skillMatchPercentage}%` }}
                />
              </div>
              {legSkills.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {crew.skills.filter(s => legSkills.includes(s.name)).length}/{legSkills.length} skills match
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Skills Section - Responsive (Single Column on Mobile) */}
      {crew.skills && (Array.isArray(crew.skills) ? crew.skills.length > 0 : typeof crew.skills === 'object') && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Skills & Description</p>

          {/* Desktop Table View (md and up) */}
          <div className="hidden md:block border border-border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-sm min-w-[150px]">skillname:</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-sm">description:</th>
                </tr>
              </thead>
              <tbody>
                {crew.skills.map((skillObj: any, index: number) => {
                  const skillName = String(skillObj?.name || '').trim();
                  const skillDescription = String(skillObj?.description || '').trim();
                  if (!skillName) return null;

                  return (
                    <tr
                      key={index}
                      className={`${
                        index % 2 === 0 ? 'bg-white' : 'bg-muted/5'
                      } border-b border-border last:border-b-0 hover:bg-muted/15 transition-colors`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground text-sm align-top">
                        <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary rounded-md whitespace-nowrap">
                          {toDisplaySkillName(skillName)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground text-sm leading-relaxed align-top">
                        {skillDescription ? (
                          <span className="text-gray-700">{skillDescription}</span>
                        ) : (
                          <span className="text-muted-foreground italic">No description provided</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Single Column) */}
          <div className="md:hidden space-y-3">
            {crew.skills.map((skillObj: any, index: number) => {
              const skillName = String(skillObj?.name || '').trim();
              const skillDescription = String(skillObj?.description || '').trim();
              if (!skillName) return null;

              return (
                <div
                  key={index}
                  className="border border-border rounded-lg p-4 bg-muted/5 hover:bg-muted/15 transition-colors"
                >
                  <div className="mb-2">
                    <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary rounded-md whitespace-nowrap text-xs font-medium">
                      {toDisplaySkillName(skillName)}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed">
                    {skillDescription ? (
                      <p className="text-gray-700">{skillDescription}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No description provided</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
