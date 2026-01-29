'use client';

import { MatchBadge } from '@/app/components/ui/MatchBadge';
import { getMatchingAndMissingSkills } from '@/app/lib/skillMatching';
import { toDisplaySkillName } from '@/app/lib/skillUtils';

type SkillsMatchingDisplayProps = {
  legSkills: string[];
  userSkills?: string[];
  skillMatchPercentage?: number;
  showHeader?: boolean;
  headerText?: string;
  compact?: boolean; // For grid cards with limited space
  className?: string;
};

/**
 * Reusable component to display skills matching information
 * Shows match percentage badge and breakdown of matching/missing skills
 */
export function SkillsMatchingDisplay({
  legSkills,
  userSkills = [],
  skillMatchPercentage,
  showHeader = true,
  headerText = 'Required Skills',
  compact = false,
  className = '',
}: SkillsMatchingDisplayProps) {
  if (!legSkills || legSkills.length === 0) {
    return null;
  }

  const hasUserSkills = userSkills.length > 0;
  const showMatchBreakdown = hasUserSkills && skillMatchPercentage !== undefined;

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground">{headerText}</h3>
          {/*
          {skillMatchPercentage !== undefined && hasUserSkills && (
            <MatchBadge percentage={skillMatchPercentage} size="sm" />
          )} 
          */}
        </div>
      )}

      {showMatchBreakdown ? (
        <div className={(compact ? 'space-y-1.5' : 'space-y-2') + ' text-left'}>
          {(() => {
            const { matching, missing } = getMatchingAndMissingSkills(userSkills, legSkills);
            return (
              <>
                {matching.length > 0 && (
                  <div>
                    <p className={`${compact ? 'text-xs' : 'text-xs'} font-medium text-green-700 mb-1`}>
                      ✓ You have ({matching.length}/{legSkills.length}):
                    </p>
                    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`}>
                      {(compact ? matching.slice(0, 3) : matching).map((skill, index) => (
                        <span
                          key={`match-${index}`}
                          className={`px-2 ${compact ? 'py-0.5' : 'py-1'} bg-green-100 text-green-800 rounded-full text-xs border border-green-300`}
                        >
                          {toDisplaySkillName(skill)}
                        </span>
                      ))}
                      {compact && matching.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{matching.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
                {missing.length > 0 && (
                  <div>
                    <p className={`${compact ? 'text-xs' : 'text-xs'} font-medium text-orange-700 mb-1`}>
                      ⚠ Missing ({missing.length}/{legSkills.length}):
                    </p>
                    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`}>
                      {(compact ? missing.slice(0, 3) : missing).map((skill, index) => (
                        <span
                          key={`missing-${index}`}
                          className={`px-2 ${compact ? 'py-0.5' : 'py-1'} bg-orange-100 text-orange-800 rounded-full text-xs border border-orange-300`}
                        >
                          {skill}
                        </span>
                      ))}
                      {compact && missing.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{missing.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        /* If user has no skills, show all required skills */
        <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`}>
          {legSkills.map((skill, index) => (
            <span
              key={index}
              className={`px-2 ${compact ? 'py-0.5' : 'py-1'} bg-accent text-accent-foreground rounded-full text-xs border`}
            >
              {toDisplaySkillName(skill)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
