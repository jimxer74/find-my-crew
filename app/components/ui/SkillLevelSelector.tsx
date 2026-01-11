'use client';

import { useState } from 'react';
import Image from 'next/image';

type SkillLevel = 'Beginner' | 'Competent Crew' | 'Coastal Skipper' | 'Offshore Skipper';

type SkillLevelSelectorProps = {
  value: SkillLevel | null;
  onChange: (value: SkillLevel | null) => void;
};

export function SkillLevelSelector({ value, onChange }: SkillLevelSelectorProps) {
  const [showBeginnerTooltip, setShowBeginnerTooltip] = useState(false);
  const [showConfidentCrewTooltip, setShowConfidentCrewTooltip] = useState(false);
  const [showCompetentCoastalTooltip, setShowCompetentCoastalTooltip] = useState(false);
  const [showAdvancedTooltip, setShowAdvancedTooltip] = useState(false);

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-foreground mb-3">
        Sailing skill level
      </label>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Beginner */}
        <button
          type="button"
          onClick={() => onChange(value === 'Beginner' ? null : 'Beginner')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Beginner'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowBeginnerTooltip(true)}
            onMouseLeave={() => setShowBeginnerTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showBeginnerTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  Little to no previous time on sailboats (0–10–15 days total). May have done a short introductory sail. Understands very basic concepts but cannot yet apply them independently. Can be a helpful crew member under close supervision.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Beginner</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/seaman2.png"
              alt="Beginner"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Competent Crew */}
        <button
          type="button"
          onClick={() => onChange(value === 'Competent Crew' ? null : 'Competent Crew')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Competent Crew'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowConfidentCrewTooltip(true)}
            onMouseLeave={() => setShowConfidentCrewTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showConfidentCrewTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  Roughly 10–50 days on the water (mix of crew and helm time). Can actively crew on most points of sail, handle basic maneuvers (tacking, gybing, reefing), assist with mooring/docking. Has skippered small boats in light to moderate conditions in familiar, protected waters.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Competent Crew</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/seaman2.png"
              alt="Competent Crew"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Coastal Skipper */}
        <button
          type="button"
          onClick={() => onChange(value === 'Coastal Skipper' ? null : 'Coastal Skipper')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Coastal Skipper'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowCompetentCoastalTooltip(true)}
            onMouseLeave={() => setShowCompetentCoastalTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showCompetentCoastalTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  50–150+ days on the water, with at least half as skipper/master of the vessel. Comfortable skippering 30–45 ft cruising yachts as bareboat charter captain. Can plan and execute coastal passages (day & night), handle marina berthing in crosswinds/current, reef early, manage heavy weather tactics in moderate to fresh conditions.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Coastal Skipper</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/seaman2.png"
              alt="Coastal Skipper"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Offshore Skipper */}
        <button
          type="button"
          onClick={() => onChange(value === 'Offshore Skipper' ? null : 'Offshore Skipper')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Offshore Skipper'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Info icon in top left corner */}
          <div 
            className="absolute top-2 left-2 z-10"
            onMouseEnter={() => setShowAdvancedTooltip(true)}
            onMouseLeave={() => setShowAdvancedTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-muted-foreground cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {showAdvancedTooltip && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
                <p className="text-sm text-popover-foreground">
                  150–500+ days on the water (very often several hundred), with the majority as skipper. Extensive experience skippering sailboats in challenging conditions — strong winds (30+ knots), large seas, heavy weather, long offshore passages (multi-day/night), ocean crossings. Very strong all-round seamanship.
                </p>
                {/* Tooltip arrow */}
                <div className="absolute left-4 bottom-full mb-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-popover"></div>
                <div className="absolute left-[15px] bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-border"></div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Offshore Skipper</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/seaman2.png"
              alt="Offshore Skipper"
              fill
              className="object-contain"
            />
          </div>
        </button>
      </div>
    </div>
  );
}
