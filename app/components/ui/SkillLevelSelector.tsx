'use client';

import React from 'react';
import Image from 'next/image';

type SkillLevel = 'Beginner' | 'Competent Crew' | 'Coastal Skipper' | 'Offshore Skipper';

type SkillLevelSelectorProps = {
  value: SkillLevel | null;
  onChange: (value: SkillLevel | null) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
};

const getSkillLevelInfo = (level: SkillLevel): { title: string; content: React.ReactNode } => {
  switch (level) {
    case 'Beginner':
      return {
        title: 'Beginner',
        content: (
          <div className="space-y-2">
            <p>Little to no previous time on sailboats (0–10–15 days total)</p>
            <p>May have done a short introductory sail or a "try sailing" day</p>
            <p>Understands very basic concepts (what a tiller/helm is, wind direction, points of sail) but cannot yet apply them independently</p>
            <p>Can be a helpful crew member under close supervision (grinding winches, tailing sheets, basic safety awareness)</p>
            <p>Cannot skipper even the smallest sailboat independently</p>
            <p className="font-medium">Typical equivalent: RYA Competent Crew start / ASA 101 start / "Green beginner"</p>
            <p className="italic">This level is about safety orientation, terminology, and getting comfortable on the water.</p>
          </div>
        ),
      };
    case 'Competent Crew':
      return {
        title: 'Confident Crew',
        content: (
          <div className="space-y-2">
            <p>Roughly 10–50 days on the water (mix of crew and helm time)</p>
            <p>Can actively crew on most points of sail, handle basic maneuvers (tacking, gybing, reefing), assist with mooring/docking, understand basic rules of the road</p>
            <p>Has skippered small boats (dinghies or daysailers &lt;30 ft) in light to moderate conditions in familiar, protected waters during daylight</p>
            <p>Can take the helm for short periods under supervision on larger cruising boats</p>
            <p className="font-medium">Typical equivalents: RYA Day Skipper practical + some miles / ASA 104 Basic Coastal Cruising / NauticEd Skipper Level I–II / International Bareboat Skipper (entry level)</p>
            <p className="italic">This is the "I can safely take friends out for a weekend sail in good weather" level.</p>
          </div>
        ),
      };
    case 'Coastal Skipper':
      return {
        title: 'Competent Coastal Skipper',
        content: (
          <div className="space-y-2">
            <p>50–150+ days on the water, with at least half as skipper/master of the vessel</p>
            <p>Comfortable skippering 30–45 ft cruising yachts as bareboat charter captain</p>
            <p>Can plan and execute coastal passages (day & night), handle marina berthing in crosswinds/current, reef early, manage heavy weather tactics in moderate to fresh conditions (up to ~25–30 knots)</p>
            <p>Good knowledge of navigation (electronic + traditional), weather interpretation, pilotage, and emergency procedures</p>
            <p className="font-medium">Typical equivalents: RYA Coastal Skipper / Yachtmaster Coastal / IYT Bareboat Skipper with experience / NauticEd Bareboat Charter Master Level III–IV / Most charter companies' "Level 2–3 Qualified Skipper" rating</p>
            <p className="italic">This is the most common level for confident recreational bareboat chartering in the Mediterranean, Caribbean, etc.</p>
          </div>
        ),
      };
    case 'Offshore Skipper':
      return {
        title: 'Offshore Skipper',
        content: (
          <div className="space-y-2">
            <p>150–500+ days on the water (very often several hundred), with the majority as skipper</p>
            <p>Extensive experience skippering sailboats in challenging conditions — strong winds (30+ knots), large seas, heavy weather, long offshore passages (multi-day/night), ocean crossings</p>
            <p>Very strong all-round seamanship: advanced boat handling (including under storm sails or bare poles), heavy weather tactics, jury rigging, man-overboard in rough conditions, long-distance navigation & routing, crew management in stressful situations</p>
            <p>Has likely completed long offshore passages (e.g., Atlantic crossing, multi-week voyages)</p>
            <p className="font-medium">Typical equivalents: RYA Yachtmaster Offshore / Ocean / IYT Yachtmaster Offshore / NauticEd Captain rank + Level V / Charter company "Expert Level" rating with proven offshore resume</p>
            <p className="italic">This level represents the serious, years-of-experience skippers who can confidently take a boat almost anywhere, in almost any conditions, while keeping safety margins high. Many charter companies and sailing communities use similar 3–5 tier systems, but this 4-level breakdown nicely matches the progression from "never sailed" → "can take friends out" → "confident charter skipper" → "seasoned offshore sailor".</p>
          </div>
        ),
      };
  }
};

export function SkillLevelSelector({ value, onChange, onInfoClick }: SkillLevelSelectorProps) {
  const handleClick = (level: SkillLevel) => {
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
      <label className="block text-sm font-medium text-foreground mb-3">
        Sailing skill level
      </label>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Beginner */}
        <button
          type="button"
          onClick={() => handleClick('Beginner')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Beginner'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
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
          onClick={() => handleClick('Competent Crew')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Competent Crew'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
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
          onClick={() => handleClick('Coastal Skipper')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Coastal Skipper'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
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
          onClick={() => handleClick('Offshore Skipper')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value === 'Offshore Skipper'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
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
