'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import { useTheme } from '@/app/contexts/ThemeContext';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type RiskLevelSelectorProps = {
  value: RiskLevel | RiskLevel[] | null;
  onChange: (value: RiskLevel | RiskLevel[] | null) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  onClose?: () => void;
  singleSelect?: boolean; // If true, only allow single selection
  profileValue?: RiskLevel | RiskLevel[] | null;
  showProfileIndicator?: boolean;
  showRequiredBadge?: boolean;
};

// Helper function to render a section with items
const renderSection = (section: { title: string; items: Array<{ label: string; text: string }>; intro?: string; conclusion?: string; finalNote?: string }) => (
  <div>
    <h4 className="font-semibold mb-2">{section.title}</h4>
    {section.intro && <p className="mb-2">{section.intro}</p>}
    <ul className="space-y-1 list-none">
      {section.items.map((item, index) => (
        <li key={index}><strong>{item.label}</strong> — {item.text}</li>
      ))}
    </ul>
    {section.conclusion && <p className="mt-2">{section.conclusion}</p>}
    {section.finalNote && <p className="mt-2 italic">{section.finalNote}</p>}
  </div>
);

// Helper function to render risk level content from config
const renderRiskLevelContent = (config: typeof riskLevelsConfig.coastal_sailing) => (
  <div className="space-y-4">
    <div>
      {config.infoText.split('\n\n').map((paragraph, index) => (
        <p key={index} className="mb-2">{paragraph}</p>
      ))}
    </div>
    {renderSection(config.typicalExperience)}
    {renderSection(config.mainRisks)}
    {renderSection(config.skillsNeeded)}
  </div>
);

const getRiskLevelInfo = (level: RiskLevel): { title: string; content: React.ReactNode } => {
  switch (level) {
    case 'Coastal sailing':
      return {
        title: riskLevelsConfig.coastal_sailing.title,
        content: renderRiskLevelContent(riskLevelsConfig.coastal_sailing),
      };
    case 'Offshore sailing':
      return {
        title: riskLevelsConfig.offshore_sailing.title,
        content: renderRiskLevelContent(riskLevelsConfig.offshore_sailing),
      };
    case 'Extreme sailing':
      return {
        title: riskLevelsConfig.extreme_sailing.title,
        content: renderRiskLevelContent(riskLevelsConfig.extreme_sailing),
      };
  }
};

export function RiskLevelSelector({
  value,
  onChange,
  onInfoClick,
  onClose,
  singleSelect = false,
  profileValue = null,
  showProfileIndicator = false,
  showRequiredBadge = false
}: RiskLevelSelectorProps) {
  const t = useTranslations('common');
  const tFilters = useTranslations('journeys.browse.filters');
  // Normalize value to array for internal use
  const valueArray = Array.isArray(value) ? value : value ? [value] : [];
  const profileArray = Array.isArray(profileValue) ? profileValue : profileValue ? [profileValue] : [];
  const isEmpty = valueArray.length === 0;
  const theme = useTheme();
  
  const isSelected = (level: RiskLevel) => {
    if (singleSelect) {
      return value === level;
    }
    return valueArray.includes(level);
  };

  const isProfileValue = (level: RiskLevel) => {
    return showProfileIndicator && profileArray.includes(level);
  };

  const handleClick = (level: RiskLevel) => {
    if (singleSelect) {
      // Single select mode: toggle the selected value
      const newValue = value === level ? null : level;
      onChange(newValue);
      
      // Show info for selected risk level
      if (onInfoClick) {
        if (newValue) {
          const info = getRiskLevelInfo(newValue);
          onInfoClick(info.title, info.content);
        } else if (onClose) {
          onClose();
        }
      }
    } else {
      // Multi-select mode (original behavior)
      const wasSelected = valueArray.includes(level);
      const newValue: RiskLevel[] = wasSelected
        ? valueArray.filter((v): v is RiskLevel => v !== level)
        : [...valueArray, level];
      onChange(newValue);
      
      // Show info for all selected risk levels, or close if none selected
      if (onInfoClick) {
        if (newValue.length > 0) {
          // If a level was just selected (not deselected), it's the last selected one
          const lastSelectedLevel = wasSelected ? null : level;
          
          // Get info for all selected levels
          const allInfo = newValue.map(level => getRiskLevelInfo(level));
          
          // Find the last selected level's info to show at top
          const lastSelectedInfo = lastSelectedLevel 
            ? getRiskLevelInfo(lastSelectedLevel)
            : null;
          
          // Get other selected levels (excluding the last selected one)
          const otherSelectedLevels = lastSelectedLevel
            ? newValue.filter(l => l !== lastSelectedLevel)
            : newValue;
          const otherInfo = otherSelectedLevels.map(level => getRiskLevelInfo(level));
          
          const combinedTitle = newValue.length === 1 
            ? allInfo[0].title 
            : allInfo[0].title; // Use first title instead of "Selected Risk Levels"
          
          const combinedContent = (
            <div className="space-y-4">
              {/* Show last selected risk level info at the top */}
              {lastSelectedInfo && (
                <div>
                  <h4 className="font-semibold mb-2">{lastSelectedInfo.title}</h4>
                  {lastSelectedInfo.content}
                </div>
              )}
              {/* Show other selected risk levels below */}
              {otherInfo.length > 0 && (
                <>
                  {otherInfo.map((info, index) => (
                    <div key={index}>
                      <h4 className="font-semibold mb-2">{info.title}</h4>
                      {info.content}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
          onInfoClick(combinedTitle, combinedContent);
        } else if (onClose) {
          onClose();
        }
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-foreground mb-2 md:mb-3">
        {singleSelect ? tFilters('riskLevel') : tFilters('riskLevelPreferences')}
        {showRequiredBadge && isEmpty && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded">
            {t('pleaseComplete')}
          </span>
        )}
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:gap-2 auto-rows-fr items-start">
        {/* Coastal sailing */}
        <button
          type="button"
          onClick={() => handleClick('Coastal sailing')}
          className={`relative p-2 md:p-2 border-2 rounded-lg bg-card transition-all flex flex-col items-start  ${
            isSelected('Coastal sailing')
              ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }`}
        >
          {isProfileValue('Coastal sailing') && (
            <div className="absolute top-1 right-1">
              <div className="bg-gray-500 text-white text-[8px] md:text-xs px-1 md:px-1.5 py-0.5 rounded font-medium">
                {t('profile')}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1 sm:gap-1 md:gap-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex-shrink-0 relative">
              <Image
                src={theme.resolvedTheme === 'dark' ? "/coastal_sailing_dark.png" : "/coastal_sailing.png"}
                alt="Coastal sailing"
                fill
                className={`object-contain transition-opacity ${
                  isSelected('Coastal sailing') ? 'opacity-100' : 'opacity-70'
                }`}
              />
            </div>
            <div className="flex items-center justify-centerflex-shrink-0">
              <h3 className={`font-semibold text-center text-xs md:text-sm ${
                isSelected('Coastal sailing') ? 'text-primary font-bold' : 'text-card-foreground'
              }`}>
                Coastal sailing
              </h3>
            </div>
          </div>
        </button>

        {/* Offshore sailing */}
        <button
          type="button"
          onClick={() => handleClick('Offshore sailing')}
          className={`relative p-2 md:p-2 border-2 rounded-lg bg-card transition-all flex flex-col items-start ${
            isSelected('Offshore sailing')
              ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }`}
        >
          {isProfileValue('Offshore sailing') && (
            <div className="absolute top-1 right-1">
              <div className="bg-gray-500 text-white text-[8px] md:text-xs px-1 md:px-1.5 py-0.5 rounded font-medium">
                {t('profile')}
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-1 sm:gap-1 md:gap-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex-shrink-0 relative">
              <Image
                src={theme.resolvedTheme === 'dark' ? "/offshore_sailing_dark.png" : "/offshore_sailing.png"}
                alt="Offshore sailing"
                fill
                className={`object-contain transition-opacity ${
                  isSelected('Offshore sailing') ? 'opacity-100' : 'opacity-70'
                }`}
              />
            </div>
            <div className="flex items-center justify-center flex-shrink-0">
              <h3 className={`font-semibold text-center text-xs md:text-sm ${
                isSelected('Offshore sailing') ? 'text-primary font-bold' : 'text-card-foreground'
              }`}>
                Offshore sailing
              </h3>
            </div>
          </div>
        </button>

        {/* Extreme sailing */}
        <button
          type="button"
          onClick={() => handleClick('Extreme sailing')}
          className={`relative p-2 md:p-2 border-2 rounded-lg bg-card transition-all flex flex-col items-start ${
            isSelected('Extreme sailing')
              ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }`}
        >
          {isProfileValue('Extreme sailing') && (
            <div className="absolute top-1 right-1">
              <div className="bg-gray-500 text-white text-[8px] md:text-xs px-1 md:px-1.5 py-0.5 rounded font-medium">
                {t('profile')}
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-1 sm:gap-1 md:gap-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex-shrink-0 relative">
            <Image
              src={theme.resolvedTheme === 'dark' ? "/extreme_sailing_dark.png" : "/extreme_sailing.png"}
              alt="Extreme sailing"
              fill
              className={`object-contain transition-opacity ${
                isSelected('Extreme sailing') ? 'opacity-100' : 'opacity-70'
              }`}
            />
          </div>
          <div className="flex items-center justify-centerflex-shrink-0">
            <h3 className={`font-semibold text-center text-xs md:text-sm ${
              isSelected('Extreme sailing') ? 'text-primary font-bold' : 'text-card-foreground'
            }`}>
              Extreme sailing
            </h3>
          </div>
          </div>
        </button>
      </div>
    </div>
  );
}
