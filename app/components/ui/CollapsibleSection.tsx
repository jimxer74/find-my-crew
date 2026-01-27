'use client';

import { useState } from 'react';

type CollapsibleSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  sectionNumber?: number; // For numbered sections like "1. Personal Information"
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
  sectionNumber,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const displayTitle = sectionNumber ? `${sectionNumber}. ${title}` : title;

  return (
    <div className="bg-card rounded-lg shadow mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{displayTitle}</h2>
          {badge}
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-6 pb-6 p-4">{children}</div>}
    </div>
  );
}
