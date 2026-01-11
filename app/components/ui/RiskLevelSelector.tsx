'use client';

import { useState } from 'react';
import Image from 'next/image';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type RiskLevelSelectorProps = {
  value: RiskLevel[];
  onChange: (value: RiskLevel[]) => void;
};

export function RiskLevelSelector({ value, onChange }: RiskLevelSelectorProps) {
  const [showCoastalTooltip, setShowCoastalTooltip] = useState(false);
  const [showOffshoreTooltip, setShowOffshoreTooltip] = useState(false);
  const [showExtremeTooltip, setShowExtremeTooltip] = useState(false);

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-foreground mb-3">
        Risk Level
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coastal sailing */}
        <button
          type="button"
          onClick={() => {
            const newValue: RiskLevel[] = value.includes('Coastal sailing')
              ? value.filter((v): v is RiskLevel => v !== 'Coastal sailing')
              : [...value, 'Coastal sailing'];
            onChange(newValue);
          }}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Coastal sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowCoastalTooltip(true)}
            onMouseLeave={() => setShowCoastalTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showCoastalTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  Sailing leisurely in short hops mostly in benign conditions close to coast. Plenty of options to duck and hide if weather gets bad. This is "champange sailing" at its best.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
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
          onClick={() => {
            const newValue: RiskLevel[] = value.includes('Offshore sailing')
              ? value.filter((v): v is RiskLevel => v !== 'Offshore sailing')
              : [...value, 'Offshore sailing'];
            onChange(newValue);
          }}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Offshore sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowOffshoreTooltip(true)}
            onMouseLeave={() => setShowOffshoreTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showOffshoreTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  Longer passages in open ocean where conditions are not allways optimal. Some chance of severe and challenging weather, though not highly probable
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
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
          onClick={() => {
            const newValue: RiskLevel[] = value.includes('Extreme sailing')
              ? value.filter((v): v is RiskLevel => v !== 'Extreme sailing')
              : [...value, 'Extreme sailing'];
            onChange(newValue);
          }}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Extreme sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowExtremeTooltip(true)}
            onMouseLeave={() => setShowExtremeTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showExtremeTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  Offshore sailing in long distances and in very remote areas, like high and low latitudes, Southern Ocean etc. Bad weather and extreme conditions are the norm - not the exception.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
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
