'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { ExperienceLevel, getExperienceLevelConfig, getAllExperienceLevels } from '@/app/types/experience-levels';

type SkillLevelSelectorProps = {
  value: ExperienceLevel | null;
  onChange: (value: ExperienceLevel | null) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  profileValue?: ExperienceLevel | null;
  showProfileIndicator?: boolean;
  showWarning?: boolean;
  onWarning?: (message: string | null) => void;
  showRequiredBadge?: boolean;
};

const getSkillLevelInfo = (level: ExperienceLevel): { title: string; content: React.ReactNode } => {
  const config = getExperienceLevelConfig(level);
  
  // Split infoText by newlines to create paragraphs
  const paragraphs = config.infoText.split('\n\n').filter(p => p.trim().length > 0);
  
  return {
    title: config.displayName,
    content: (
      <div className="space-y-2">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {config.typicalEquivalents && (
          <p className="font-medium">Typical equivalents: {config.typicalEquivalents}</p>
        )}
        {config.note && (
          <p className="italic">{config.note}</p>
        )}
      </div>
    ),
  };
};

export function SkillLevelSelector({ 
  value, 
  onChange, 
  onInfoClick,
  profileValue = null,
  showProfileIndicator = false,
  showWarning = false,
  onWarning,
  showRequiredBadge = false
}: SkillLevelSelectorProps) {
  const levels = getAllExperienceLevels();
  
  // Check if selected level is higher than profile level
  const isHigherThanProfile = showWarning && 
    profileValue !== null && 
    value !== null && 
    value > profileValue;

  // Update warning when value changes
  useEffect(() => {
    if (showWarning && onWarning) {
      if (isHigherThanProfile) {
        const profileConfig = getExperienceLevelConfig(profileValue!);
        const selectedConfig = getExperienceLevelConfig(value!);
        onWarning(`You've selected ${selectedConfig.displayName}, which is higher than your profile level (${profileConfig.displayName}). Make sure you're comfortable with this level.`);
      } else {
        onWarning(null);
      }
    }
  }, [value, profileValue, showWarning, isHigherThanProfile, onWarning]);

  const handleClick = (level: ExperienceLevel) => {
    const newValue = value === level ? null : level;
    onChange(newValue);
    
    // Show info for selected level
    if (onInfoClick && newValue) {
      const info = getSkillLevelInfo(newValue);
      onInfoClick(info.title, info.content);
    }
  };

  const isProfileValue = (level: ExperienceLevel) => {
    return showProfileIndicator && profileValue === level;
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-foreground mb-2 md:mb-3">
        Sailing Experience Level
        {showRequiredBadge && value === null && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded">
            Please complete
          </span>
        )}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
        {levels.map((levelConfig) => {
          const isSelected = value === levelConfig.value;
          const isProfile = isProfileValue(levelConfig.value);
          
          return (
            <button
              key={levelConfig.value}
              type="button"
              onClick={() => handleClick(levelConfig.value)}
              className={`relative p-2 md:p-4 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
            >
              {/* Profile indicator badge */}
              {isProfile && (
                <div className="absolute top-1 right-1 z-10">
                  <div className="bg-blue-500 text-white text-[8px] md:text-xs px-1 md:px-1.5 py-0.5 rounded font-medium">
                    Profile
                  </div>
                </div>
              )}
              <div className="flex items-center justify-center mb-1 md:mb-2 flex-shrink-0">
                <h3 className={`font-semibold text-center leading-tight text-[10px] md:text-sm ${
                  isSelected ? 'text-primary font-bold' : 'text-card-foreground'
                }`}>
                  {levelConfig.displayName}
                </h3>
              </div>
              <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
                <Image
                  src={levelConfig.icon}
                  alt={levelConfig.displayName}
                  fill
                  className={`object-contain transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-70'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
