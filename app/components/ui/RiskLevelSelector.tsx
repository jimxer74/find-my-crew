'use client';

import React from 'react';
import Image from 'next/image';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type RiskLevelSelectorProps = {
  value: RiskLevel[];
  onChange: (value: RiskLevel[]) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  onClose?: () => void;
};

const getRiskLevelInfo = (level: RiskLevel): { title: string; content: React.ReactNode } => {
  switch (level) {
    case 'Coastal sailing':
      return {
        title: 'Coastal sailing',
        content: (
          <p>Sailing leisurely in short hops mostly in benign conditions close to coast. Plenty of options to duck and hide if weather gets bad. This is "champange sailing" at its best.</p>
        ),
      };
    case 'Offshore sailing':
      return {
        title: 'Offshore sailing',
        content: (
          <p>Longer passages in open ocean where conditions are not allways optimal. Some chance of severe and challenging weather, though not highly probable</p>
        ),
      };
    case 'Extreme sailing':
      return {
        title: 'Extreme sailing',
        content: (
          <p>Offshore sailing in long distances and in very remote areas, like high and low latitudes, Southern Ocean etc. Bad weather and extreme conditions are the norm - not the exception.</p>
        ),
      };
  }
};

export function RiskLevelSelector({ value, onChange, onInfoClick, onClose }: RiskLevelSelectorProps) {
  const handleClick = (level: RiskLevel) => {
    const newValue: RiskLevel[] = value.includes(level)
      ? value.filter((v): v is RiskLevel => v !== level)
      : [...value, level];
    onChange(newValue);
    
    // Show info for all selected risk levels, or close if none selected
    if (onInfoClick) {
      if (newValue.length > 0) {
        const allInfo = newValue.map(level => getRiskLevelInfo(level));
        const combinedTitle = newValue.length === 1 
          ? allInfo[0].title 
          : `Selected Risk Levels (${newValue.length})`;
        const combinedContent = (
          <div className="space-y-4">
            {allInfo.map((info, index) => (
              <div key={index}>
                <h4 className="font-semibold mb-2">{info.title}</h4>
                {info.content}
              </div>
            ))}
          </div>
        );
        onInfoClick(combinedTitle, combinedContent);
      } else if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-foreground mb-3">
        Risk Level
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coastal sailing */}
        <button
          type="button"
          onClick={() => handleClick('Coastal sailing')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Coastal sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Coastal sailing</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/coastal_sailing2.png"
              alt="Coastal sailing"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Offshore sailing */}
        <button
          type="button"
          onClick={() => handleClick('Offshore sailing')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Offshore sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Offshore sailing</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/offshore_sailing2.png"
              alt="Offshore sailing"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Extreme sailing */}
        <button
          type="button"
          onClick={() => handleClick('Extreme sailing')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Extreme sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Extreme sailing</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/extreme_sailing2.png"
              alt="Extreme sailing"
              fill
              className="object-contain"
            />
          </div>
        </button>
      </div>
    </div>
  );
}
