'use client';

import React from 'react';
import Image from 'next/image';
import { ExperienceLevel, getExperienceLevelConfig, getAllExperienceLevels } from '@/app/types/experience-levels';

type SkillLevelSelectorProps = {
  value: ExperienceLevel | null;
  onChange: (value: ExperienceLevel | null) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
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

export function SkillLevelSelector({ value, onChange, onInfoClick }: SkillLevelSelectorProps) {
  const levels = getAllExperienceLevels();
  
  const handleClick = (level: ExperienceLevel) => {
    const newValue = value === level ? null : level;
    onChange(newValue);
    
    // Show info for selected level
    if (onInfoClick && newValue) {
      const info = getSkillLevelInfo(newValue);
      onInfoClick(info.title, info.content);
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-foreground mb-2 md:mb-3">
        Experience level
      </label>
      <div className="grid grid-cols-4 gap-1.5 md:gap-4">
        {levels.map((levelConfig) => (
          <button
            key={levelConfig.value}
            type="button"
            onClick={() => handleClick(levelConfig.value)}
            className={`relative p-1.5 md:p-3 border md:border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
              value === levelConfig.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-center mb-0.5 md:mb-2 flex-shrink-0">
              <h3 className="font-semibold text-card-foreground text-[10px] md:text-sm text-center leading-tight">
                {levelConfig.displayName}
              </h3>
            </div>
            <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
              <Image
                src={levelConfig.icon}
                alt={levelConfig.displayName}
                fill
                className="object-contain"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
